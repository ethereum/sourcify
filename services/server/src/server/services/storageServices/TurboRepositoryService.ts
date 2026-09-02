/**
 * Write-only storage service that uploads verified contract files to Arweave
 * through the ArDrive Turbo upload service.
 *
 * Arweave is append-only: a data item can never be updated or removed once it
 * is uploaded. The service therefore implements `WStorageService` only, and
 * `deletePartialIfExists` is a no-op. A later full match is uploaded as a new
 * set of data items which supersedes the partial one; consumers select the
 * `Match-Quality: full` items.
 *
 * Every file is uploaded as its own ANS-104 data item tagged with the chain id,
 * the contract address and the match quality, so the files of a contract can be
 * found again with a gateway GraphQL tag query and read from any AR.IO gateway
 * at `<gatewayUrl>/<dataItemId>`.
 *
 * Turbo is a third-party network that has to be paid for, so this service is
 * meant to be configured under `storage.writeOrWarn`: a Turbo outage then
 * degrades to a warning instead of failing the verification.
 *
 * Uploading is done with `@ardrive/turbo-upload`, which signs an Arweave JWK
 * and POSTs the data item and does nothing else. It has no dependencies of its
 * own, so enabling this service adds one package to the server's tree.
 */

import { TurboUpload, TurboHTTPError } from "@ardrive/turbo-upload";
import type { SignedDataItem, Tag } from "@ardrive/turbo-upload";
import { getAddress } from "ethers";
import Path from "path";
import { RepositoryV2Service } from "./RepositoryV2Service";
import type { WStorageService } from "../StorageService";
import { WStorageIdentifiers } from "./identifiers";
import logger from "../../../common/logger";
import type { PathConfig, TurboConfig } from "../../types";

export type TurboRepositoryServiceOptions = TurboConfig;

const DEFAULT_APP_NAME = "Sourcify";
// The gateway the upload service names as its own, in the `gateway` field of
// its `/v1/info`. This is only the URL recorded and logged for an uploaded
// item, never where it is uploaded, but it is the URL an operator will open.
// It was `arweave.net`, which answered `429` to every read of four items that
// had just been uploaded, while this one answered `200` to all of them. Any
// gateway serving Arweave returns an item by id, and gateways differ in what
// they have indexed, so set `gatewayUrl` deliberately rather than inheriting.
const DEFAULT_GATEWAY_URL = "https://turbo-gateway.com";
// Bounds an upload end to end. @ardrive/turbo-upload applies `timeoutMs` per
// HTTP request and retries transient failures three times, so the client
// setting alone would allow a hung endpoint to hold a verification for four
// timeouts plus backoff. The same value is therefore also imposed on the whole
// operation with an AbortSignal.
const DEFAULT_UPLOAD_TIMEOUT = 60 * 1000;
// What the upload service answers when the wallet cannot cover the item, and
// the free tier does not either. Verified against the AR.IO bundler: a
// zero-balance wallet posting an item above the free-tier ceiling gets
// `402 Payment Required` with an x402 payment challenge as the body.
const PAYMENT_REQUIRED_STATUS = 402;
// Being unable to pay is a standing condition, not an event: it stays broken
// until someone funds the wallet, and every verification after that fails the
// same way. `storeVerification` stops at the first failing file, so this is one
// alarm per verification rather than one per file -- still one per verification
// for as long as the wallet is empty. Announced once, then at most this often.
const CREDIT_ALARM_INTERVAL = 15 * 60 * 1000;

export class TurboRepositoryService
  extends RepositoryV2Service
  implements WStorageService
{
  IDENTIFIER = WStorageIdentifiers.TurboRepository;
  private turbo: TurboUpload;
  private appName: string;
  private gatewayUrl: string;
  private uploadTimeout: number;
  private minBalanceWinc: bigint;
  private abortController: AbortController;
  /** True from the first upload refused for payment until the next success. */
  private outOfCredit = false;
  private lastCreditAlarm = 0;
  private uploadsLostToPayment = 0;

  constructor(options: TurboRepositoryServiceOptions) {
    super({ repositoryPath: "" });
    this.appName = options.appName || DEFAULT_APP_NAME;
    this.gatewayUrl = (options.gatewayUrl || DEFAULT_GATEWAY_URL).replace(
      /\/+$/,
      "",
    );
    this.uploadTimeout = options.uploadTimeout || DEFAULT_UPLOAD_TIMEOUT;
    this.minBalanceWinc = this.parseMinBalanceWinc(options.minBalanceWinc);
    this.abortController = new AbortController();
    // The client validates all of this in its constructor and throws an error
    // that names the problem, so a malformed JWK or an unsupported token is a
    // startup failure rather than a mystery on the first upload. Nothing is
    // pre-checked here on purpose. The only normalisation is the empty string:
    // an env var that is present but unset arrives as `""`, which is a
    // missing value and not a bad one.
    this.turbo = new TurboUpload({
      jwk: options.privateKey,
      token: options.token || undefined,
      uploadUrl: options.uploadServiceUrl || undefined,
      timeoutMs: this.uploadTimeout,
    });
  }

  async init() {
    // An empty balance is not an error: small items are free. It is still worth
    // saying out loud, because the free tier is a fixed lifetime allowance and
    // not a standing exemption, and the day it runs out every upload starts
    // failing. Never let an unreachable Turbo stop the server from booting.
    try {
      const [balance, info] = await Promise.all([
        this.turbo.getBalance(),
        this.turbo.getInfo(),
      ]);
      // /v1/info reports the free tier's LIMITS, not how much of it this wallet
      // or this IP has already spent, so the remaining allowance cannot be
      // reported here. The limits are logged so an operator can see the size of
      // the runway they are relying on.
      const freeTier = {
        perItemBytes: info.freeUploadLimitBytes,
        lifetimeBytes: info.freeTier?.lifetimeBytes,
        perIpBytes: info.freeTier?.ipBytes,
      };

      if (this.isBelowMinBalance(balance.winc)) {
        logger.warn(
          `${this.IDENTIFIER} has no credit to spend: uploads are free only until the free tier is used up, after which nothing more is archived to Arweave`,
          {
            address: this.turbo.address,
            winc: balance.winc,
            minBalanceWinc: this.minBalanceWinc.toString(),
            freeTier,
            gatewayUrl: this.gatewayUrl,
          },
        );
      } else {
        logger.info(`${this.IDENTIFIER} initialized`, {
          address: this.turbo.address,
          winc: balance.winc,
          freeTier,
          gatewayUrl: this.gatewayUrl,
        });
      }
    } catch (error) {
      logger.warn(`${this.IDENTIFIER} initialized without reaching Turbo`, {
        error,
        address: this.turbo.address,
        gatewayUrl: this.gatewayUrl,
      });
    }
    return true;
  }

  async close() {
    this.abortController.abort();
    logger.info(`${this.IDENTIFIER} closed`);
  }

  /**
   * Arweave data is permanent, partial matches cannot be deleted. The full
   * match uploaded afterwards carries the `Match-Quality: full` tag and
   * supersedes them.
   */
  async deletePartialIfExists(chainId: string, address: string) {
    logger.debug(
      `Cannot delete partial matches from ${this.IDENTIFIER}, Arweave data is permanent`,
      { chainId, address },
    );
  }

  async save(path: PathConfig, content: string) {
    const filePath = this.generateRelativeFilePath(path);
    const tags: Tag[] = [
      { name: "App-Name", value: this.appName },
      { name: "Content-Type", value: this.contentType(path.fileName) },
      { name: "Chain-Id", value: path.chainId },
      { name: "Contract-Address", value: getAddress(path.address) },
      { name: "Match-Quality", value: path.matchQuality },
      { name: "File-Path", value: filePath },
    ];

    let item: SignedDataItem | undefined;
    try {
      // Signed first so the data item id exists before the write leaves the
      // process: an upload that times out may still have landed, and the id is
      // the only handle on it. `uploadSigned` posts exactly these bytes.
      // `upload` would sign a second time, and because RSA-PSS draws a fresh
      // salt per signature the id it returned would not be the one logged here.
      item = this.turbo.sign({ data: content, tags });
      logger.debug(`Uploading file to ${this.IDENTIFIER}`, {
        dataItemId: item.idB64Url,
        byteCount: item.binary.length,
        filePath,
      });

      const { id, winc } = await this.turbo.uploadSigned(item, {
        signal: this.uploadSignal(),
      });
      this.noteUploadPaid();
      // The data item id is the only handle on an irreversible write, so it is
      // logged for every upload.
      logger.info(`Stored file to ${this.IDENTIFIER}`, {
        dataItemId: id,
        url: `${this.gatewayUrl}/${id}`,
        winc,
        filePath,
      });
    } catch (error) {
      // A wallet that cannot pay is a different kind of problem from a network
      // blip: it does not clear on its own, and every later upload fails the
      // same way. It gets its own alarm so it is not lost among transient
      // errors, and so it is not repeated once per file.
      if (TurboRepositoryService.isPaymentFailure(error)) {
        this.noteUploadUnpaid(error, filePath);
      } else {
        logger.error("Failed to store file to Turbo", {
          error,
          dataItemId: item?.idB64Url,
          filePath,
        });
      }
      throw error;
    }
  }

  /**
   * The upload service answers `402 Payment Required` when neither the wallet
   * balance nor the free tier covers the item.
   */
  private static isPaymentFailure(error: unknown): error is TurboHTTPError {
    return (
      error instanceof TurboHTTPError &&
      error.status === PAYMENT_REQUIRED_STATUS
    );
  }

  /**
   * Announce that archiving has stopped, and keep saying so at intervals for as
   * long as it is true. Every refused upload is still recorded at debug level,
   * so nothing is lost, but the operator gets one alarm rather than one per
   * verification for as long as the wallet stays empty.
   */
  private noteUploadUnpaid(error: TurboHTTPError, filePath: string) {
    this.uploadsLostToPayment++;
    const now = Date.now();
    const firstFailure = !this.outOfCredit;

    if (firstFailure || now - this.lastCreditAlarm >= CREDIT_ALARM_INTERVAL) {
      this.lastCreditAlarm = now;
      logger.error(
        `${this.IDENTIFIER} cannot pay for uploads: nothing is being archived to Arweave until the wallet is funded`,
        {
          error,
          address: this.turbo.address,
          status: error.status,
          uploadsLostToPayment: this.uploadsLostToPayment,
          filePath,
          remedy: `Fund ${this.turbo.address} with Turbo credits, or remove ${this.IDENTIFIER} from storage.writeOrWarn to stop trying`,
        },
      );
    } else {
      logger.debug(`${this.IDENTIFIER} upload refused for payment`, {
        filePath,
        uploadsLostToPayment: this.uploadsLostToPayment,
      });
    }
    this.outOfCredit = true;
  }

  /** Say so once when uploads start being accepted again. */
  private noteUploadPaid() {
    if (!this.outOfCredit) {
      return;
    }
    logger.info(
      `${this.IDENTIFIER} is archiving again after being unable to pay`,
      {
        address: this.turbo.address,
        uploadsLostToPayment: this.uploadsLostToPayment,
      },
    );
    this.outOfCredit = false;
    this.lastCreditAlarm = 0;
    this.uploadsLostToPayment = 0;
  }

  /**
   * Winston credits are decimal strings that can exceed Number.MAX_SAFE_INTEGER,
   * so the threshold is held and compared as a BigInt. Parsed in the constructor
   * so a typo is a startup failure rather than something swallowed by init()'s
   * catch and reported as an unreachable Turbo.
   */
  private parseMinBalanceWinc(value?: string): bigint {
    if (!value) {
      return BigInt(0);
    }
    let parsed: bigint;
    try {
      parsed = BigInt(value.trim());
    } catch {
      throw new Error(
        `Turbo minBalanceWinc (TURBO_MIN_BALANCE_WINC) must be a whole number of winston credits, got: ${value}`,
      );
    }
    if (parsed < BigInt(0)) {
      throw new Error(
        `Turbo minBalanceWinc (TURBO_MIN_BALANCE_WINC) must not be negative, got: ${value}`,
      );
    }
    return parsed;
  }

  /** A balance that cannot be read is not a healthy balance. */
  private isBelowMinBalance(winc: string): boolean {
    try {
      return BigInt(winc) <= this.minBalanceWinc;
    } catch {
      return true;
    }
  }

  /**
   * Aborts on shutdown, and on the upload deadline. The client's own
   * `timeoutMs` bounds each request; this bounds the retries with it.
   */
  private uploadSignal() {
    return AbortSignal.any([
      this.abortController.signal,
      AbortSignal.timeout(this.uploadTimeout),
    ]);
  }

  private contentType(fileName?: string) {
    return Path.extname(fileName || "") === ".json"
      ? "application/json"
      : "text/plain";
  }
}
