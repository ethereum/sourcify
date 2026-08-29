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
 */

import { TurboFactory, tokenTypes } from "@ardrive/turbo-sdk";
import type {
  TokenType,
  TurboAuthenticatedClient,
  TurboWallet,
} from "@ardrive/turbo-sdk";
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
// The Turbo SDK's HTTP client retries but sets no request timeout of its
// own, so uploads are bounded here with an AbortSignal instead.
const DEFAULT_UPLOAD_TIMEOUT = 60 * 1000;

export class TurboRepositoryService
  extends RepositoryV2Service
  implements WStorageService
{
  IDENTIFIER = WStorageIdentifiers.TurboRepository;
  private turbo: TurboAuthenticatedClient;
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
    this.turbo = TurboFactory.authenticated({
      privateKey: this.parsePrivateKey(options.privateKey),
      token: this.parseToken(options.token),
      uploadServiceConfig: options.uploadServiceUrl
        ? { url: options.uploadServiceUrl }
        : undefined,
    });
  }

  /**
   * An Arweave wallet is a JWK object, every other token is a plain private key
   * string. Both arrive as a single environment variable.
   */
  private parsePrivateKey(privateKey: string): TurboWallet {
    const trimmed = privateKey.trim();
    if (!trimmed.startsWith("{")) {
      return trimmed;
    }
    try {
      return JSON.parse(trimmed) as TurboWallet;
    } catch (error) {
      logger.error("Failed to parse the Turbo Arweave JWK", { error });
      throw new Error("Failed to parse the Turbo Arweave JWK");
    }
  }

  /**
   * An unknown token silently builds a client without a signer that only fails
   * on the first upload, and an unset environment variable arrives as an empty
   * string, so both are rejected here.
   */
  private parseToken(token?: string): TokenType | undefined {
    if (!token) {
      return undefined;
    }
    if (!(tokenTypes as readonly string[]).includes(token)) {
      throw new Error(`Unsupported Turbo token: ${token}`);
    }
    return token as TokenType;
  }

  async init() {
    // Uploads below 100 KiB are free on Turbo, so an empty balance is not an
    // error. Report it at startup instead of failing, and never let an
    // unreachable Turbo stop the server from booting.
    try {
      const [nativeAddress, balance] = await Promise.all([
        this.turbo.signer.getNativeAddress(),
        this.turbo.getBalance(),
      ]);
      logger.info(`${this.IDENTIFIER} initialized`, {
        nativeAddress,
        winc: balance.winc,
        gatewayUrl: this.gatewayUrl,
      });
    } catch (error) {
      logger.warn(`${this.IDENTIFIER} initialized without a Turbo balance`, {
        error,
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
    const tags = [
      { name: "App-Name", value: this.appName },
      { name: "Content-Type", value: this.contentType(path.fileName) },
      { name: "Chain-Id", value: path.chainId },
      { name: "Contract-Address", value: getAddress(path.address) },
      { name: "Match-Quality", value: path.matchQuality },
      { name: "File-Path", value: filePath },
    ];

    try {
      const { id, winc } = await this.turbo.upload({
        data: content,
        dataItemOpts: { tags },
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
      logger.error("Failed to store file to Turbo", { error, filePath });
      throw error;
    }
  }

  private contentType(fileName?: string) {
    return Path.extname(fileName || "") === ".json"
      ? "application/json"
      : "text/plain";
  }

  private uploadSignal() {
    return AbortSignal.any([
      this.abortController.signal,
      AbortSignal.timeout(this.uploadTimeout),
    ]);
  }
}
