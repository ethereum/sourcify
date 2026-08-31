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

import { TurboUpload } from "@ardrive/turbo-upload";
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
const DEFAULT_GATEWAY_URL = "https://arweave.net";
// Bounds an upload end to end. @ardrive/turbo-upload applies `timeoutMs` per
// HTTP request and retries transient failures three times, so the client
// setting alone would allow a hung endpoint to hold a verification for four
// timeouts plus backoff. The same value is therefore also imposed on the whole
// operation with an AbortSignal.
const DEFAULT_UPLOAD_TIMEOUT = 60 * 1000;

export class TurboRepositoryService
  extends RepositoryV2Service
  implements WStorageService
{
  IDENTIFIER = WStorageIdentifiers.TurboRepository;
  private turbo: TurboUpload;
  private appName: string;
  private gatewayUrl: string;
  private uploadTimeout: number;
  private abortController: AbortController;

  constructor(options: TurboRepositoryServiceOptions) {
    super({ repositoryPath: "" });
    this.appName = options.appName || DEFAULT_APP_NAME;
    this.gatewayUrl = (options.gatewayUrl || DEFAULT_GATEWAY_URL).replace(
      /\/+$/,
      "",
    );
    this.uploadTimeout = options.uploadTimeout || DEFAULT_UPLOAD_TIMEOUT;
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
    // Items at or below the upload service's free limit cost nothing, so an
    // empty balance is not an error. Report the balance and that limit at
    // startup instead of failing, and never let an unreachable Turbo stop the
    // server from booting.
    try {
      const [balance, freeUploadLimitBytes] = await Promise.all([
        this.turbo.getBalance(),
        this.turbo.getFreeUploadLimitBytes(),
      ]);
      logger.info(`${this.IDENTIFIER} initialized`, {
        address: this.turbo.address,
        winc: balance.winc,
        freeUploadLimitBytes,
        gatewayUrl: this.gatewayUrl,
      });
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
      // The data item id is the only handle on an irreversible write, so it is
      // logged for every upload.
      logger.info(`Stored file to ${this.IDENTIFIER}`, {
        dataItemId: id,
        url: `${this.gatewayUrl}/${id}`,
        winc,
        filePath,
      });
    } catch (error) {
      logger.error("Failed to store file to Turbo", {
        error,
        dataItemId: item?.idB64Url,
        filePath,
      });
      throw error;
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
