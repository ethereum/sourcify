import logger from "../../../common/logger";
import AbstractDatabaseService from "./AbstractDatabaseService";
import { WStorageService } from "../StorageService";
import { CheckedContract, Match } from "@ethereum-sourcify/lib-sourcify";
import { WStorageIdentifiers } from "./identifiers";

export class AllianceDatabaseService
  extends AbstractDatabaseService
  implements WStorageService
{
  IDENTIFIER = WStorageIdentifiers.AllianceDatabase;
  async storeMatch(recompiledContract: CheckedContract, match: Match) {
    if (!match.creationMatch) {
      throw new Error("Can't store to AllianceDatabase without creationMatch");
    }
    await this.insertOrUpdateVerifiedContract(recompiledContract, match);
    logger.info("Stored to AllianceDatabase", {
      name: recompiledContract.name,
      address: match.address,
      chainId: match.chainId,
      runtimeMatch: match.runtimeMatch,
      creationMatch: match.creationMatch,
    });
  }
}
