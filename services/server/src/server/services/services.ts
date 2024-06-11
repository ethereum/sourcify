import { SourcifyChainMap } from "@ethereum-sourcify/lib-sourcify";
import { StorageService, StorageServiceOptions } from "./StorageService";
import { VerificationService } from "./VerificationService";

export class Services {
  private _verification?: VerificationService;
  private _storage?: StorageService;

  constructor(
    verificationServiceOption: SourcifyChainMap,
    storageServiceOptions: StorageServiceOptions
  ) {
    this.initialize(verificationServiceOption, storageServiceOptions);
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

  // This function allows for reloading the configuration parameters in the tests
  private initialize(
    verificationServiceOption: SourcifyChainMap,
    storageServiceOptions: StorageServiceOptions
  ) {
    this._verification = new VerificationService(verificationServiceOption);
    this._storage = new StorageService(storageServiceOptions);
  }

  public async init() {
    await this.storage.init();
  }
}
