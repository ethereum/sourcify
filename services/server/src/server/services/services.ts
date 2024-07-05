import { StorageService, StorageServiceOptions } from "./StorageService";
import {
  VerificationService,
  VerificationServiceOptions,
} from "./VerificationService";

export class Services {
  private _verification?: VerificationService;
  private _storage?: StorageService;

  constructor(
    verificationServiceOptions: VerificationServiceOptions,
    storageServiceOptions: StorageServiceOptions,
  ) {
    this._verification = new VerificationService(verificationServiceOptions);
    this._storage = new StorageService(storageServiceOptions);
  }

  // Getters for type safety
  get verification(): VerificationService {
    if (!this._verification) throw new Error("verification not initialized!");
    return this._verification;
  }
  get storage(): StorageService {
    if (!this._storage) throw new Error("storage not initialized!");
    return this._storage;
  }

  public async init() {
    await this.storage.init();
    await this.verification.init();
  }
}
