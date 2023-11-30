import {
  Match,
  CheckedContract,
  Transformation,
  Status,
} from "@ethereum-sourcify/lib-sourcify";
import { logger } from "../../../common/loggerLoki";
import { id as keccak256str } from "ethers";
import { IStorageService } from "../StorageService";
import * as AllianceDatabase from "../utils/alliance-database-util";
import { AuthTypes, Connector } from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";

export interface SourcifyDatabaseServiceOptions {
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

export class SourcifyDatabaseService implements IStorageService {
  private sourcifyDatabasePool?: any;

  postgresHost?: string;
  postgresPort?: number;
  postgresDatabase?: string;
  postgresUser?: string;
  postgresPassword?: string;

  constructor(options: SourcifyDatabaseServiceOptions) {
    this.postgresHost = options.postgres.host;
    this.postgresPort = options.postgres.port;
    this.postgresDatabase = options.postgres.database;
    this.postgresUser = options.postgres.user;
    this.postgresPassword = options.postgres.password;
  }

  async init(): Promise<boolean> {
    // if the database is already initialized
    if (this.sourcifyDatabasePool != undefined) {
      return true;
    }

    if (this.postgresHost) {
      this.sourcifyDatabasePool = new Pool({
        host: this.postgresHost,
        port: this.postgresPort,
        database: this.postgresDatabase,
        user: this.postgresUser,
        password: this.postgresPassword,
        max: 5,
      });
    } else {
      logger.warn("Sourcify Database is disabled");
      return false;
    }
    logger.warn("Sourcify Database is active");
    return true;
  }

  async checkByChainAndAddress(
    address: string,
    chainId: string
  ): Promise<Match[]> {
    if (!(await this.init())) {
      throw new Error(
        "Cannot initialize SourcifyDatabase, the database will not be updated"
      );
    }

    const existingVerifiedContractResult =
      await AllianceDatabase.getSourcifyMatchByChainAddress(
        this.sourcifyDatabasePool,
        parseInt(chainId),
        address
      );

    if (existingVerifiedContractResult.rowCount === 0) {
      return [];
    }
    return [
      {
        address,
        chainId,
        runtimeMatch: existingVerifiedContractResult.rows[0]
          .runtime_match as Status,
        creationMatch: existingVerifiedContractResult.rows[0]
          .creation_match as Status,
        storageTimestamp: existingVerifiedContractResult.rows[0]
          .created_at as Date,
      },
    ];
  }

  async storeMatch(recompiledContract: CheckedContract, match: Match) {
    if (
      recompiledContract.runtimeBytecode === undefined ||
      recompiledContract.creationBytecode === undefined ||
      match.onchainRuntimeBytecode === undefined ||
      match.onchainCreationBytecode === undefined
    ) {
      // Can only store contracts with both runtimeBytecode and creationBytecode
      return;
    }

    if (match.creatorTxHash === undefined) {
      // Can only store matches with creatorTxHash
      return;
    }

    if (!(await this.init())) {
      logger.warn(
        "Cannot initialize AllianceDatabase, the database will not be updated"
      );
      return;
    }

    const keccak256OnchainCreationBytecode = keccak256str(
      match.onchainCreationBytecode
    );
    const keccak256OnchainRuntimeBytecode = keccak256str(
      match.onchainRuntimeBytecode
    );

    const keccak256RecompiledCreationBytecode = keccak256str(
      recompiledContract.creationBytecode
    );
    const keccak256RecompiledRuntimeBytecode = keccak256str(
      recompiledContract.runtimeBytecode
    );

    // Get all the verified contracts existing in the Database for these exact onchain bytecodes.
    const existingVerifiedContractResult =
      await AllianceDatabase.getVerifiedContractByBytecodeHashes(
        this.sourcifyDatabasePool,
        keccak256OnchainRuntimeBytecode,
        keccak256OnchainCreationBytecode
      );

    const {
      runtimeTransformations,
      runtimeTransformationValues,
      creationTransformations,
      creationTransformationValues,
    } = match;
    const compilationTargetPath = Object.keys(
      recompiledContract.metadata.settings.compilationTarget
    )[0];
    const compilationTargetName = Object.values(
      recompiledContract.metadata.settings.compilationTarget
    )[0];
    const language = "solidity";
    const compilerOutput =
      recompiledContract.compilerOutput?.contracts[
        recompiledContract.compiledPath
      ][recompiledContract.name];

    if (!(await recompiledContract.generateArtifacts())) {
      logger.warn(
        `Cannot generate contract artifacts for: ${recompiledContract.name} with address ${match.address} on chain ${match.chainId}`
      );
      return;
    }

    const compilationArtifacts = {
      abi: compilerOutput?.abi || {},
      userdoc: compilerOutput?.userdoc || {},
      devdoc: compilerOutput?.devdoc || {},
      storageLayout: compilerOutput?.storageLayout || {},
    };
    const creationCodeArtifacts = {
      sourceMap: compilerOutput?.evm.bytecode.sourceMap || "",
      linkReferences: compilerOutput?.evm.bytecode.linkReferences || {},
      cborAuxdata: recompiledContract?.artifacts?.creationBytecodeCborAuxdata,
    };
    const runtimeCodeArtifacts = {
      sourceMap: compilerOutput?.evm.deployedBytecode?.sourceMap || "",
      linkReferences:
        compilerOutput?.evm.deployedBytecode?.linkReferences || {},
      immutableReferences:
        compilerOutput?.evm.deployedBytecode?.immutableReferences || {},
      cborAuxdata: recompiledContract?.artifacts?.runtimeBytecodeCborAuxdata,
    };

    const runtimeMatch =
      match.runtimeMatch === "perfect" || match.runtimeMatch === "partial";
    const creationMatch =
      match.creationMatch === "perfect" || match.creationMatch === "partial";

    if (existingVerifiedContractResult.rows.length === 0) {
      try {
        // Add recompiled bytecodes
        await AllianceDatabase.insertCode(this.sourcifyDatabasePool, {
          bytecodeHash: keccak256RecompiledCreationBytecode,
          bytecode: recompiledContract.creationBytecode,
        });
        await AllianceDatabase.insertCode(this.sourcifyDatabasePool, {
          bytecodeHash: keccak256RecompiledRuntimeBytecode,
          bytecode: recompiledContract.runtimeBytecode,
        });

        // Add onchain bytecodes
        await AllianceDatabase.insertCode(this.sourcifyDatabasePool, {
          bytecodeHash: keccak256OnchainCreationBytecode,
          bytecode: match.onchainCreationBytecode,
        });
        await AllianceDatabase.insertCode(this.sourcifyDatabasePool, {
          bytecodeHash: keccak256OnchainRuntimeBytecode,
          bytecode: match.onchainRuntimeBytecode,
        });

        // Add the onchain contract in contracts
        const contractInsertResult = await AllianceDatabase.insertContract(
          this.sourcifyDatabasePool,
          {
            creationBytecodeHash: keccak256OnchainCreationBytecode,
            runtimeBytecodeHash: keccak256OnchainRuntimeBytecode,
          }
        );

        // add the onchain contract in contract_deployments
        await AllianceDatabase.insertContractDeployment(
          this.sourcifyDatabasePool,
          {
            chainId: match.chainId,
            address: match.address,
            transactionHash: match.creatorTxHash,
            contractId: contractInsertResult.rows[0].id,
          }
        );

        // insert new recompiled contract
        const compiledContractsInsertResult =
          await AllianceDatabase.insertCompiledContract(
            this.sourcifyDatabasePool,
            {
              compiler: recompiledContract.compiledPath,
              version: recompiledContract.compilerVersion,
              language,
              name: recompiledContract.name,
              fullyQualifiedName: `${compilationTargetPath}:${compilationTargetName}`,
              compilationArtifacts,
              sources: recompiledContract.solidity,
              compilerSettings: recompiledContract.metadata.settings,
              creationCodeHash: keccak256RecompiledCreationBytecode,
              runtimeCodeHash: keccak256RecompiledRuntimeBytecode,
              creationCodeArtifacts,
              runtimeCodeArtifacts,
            }
          );

        // insert new recompiled contract with newly added contract and compiledContract
        const verifiedContractInsertResult =
          await AllianceDatabase.insertVerifiedContract(
            this.sourcifyDatabasePool,
            {
              compilationId: compiledContractsInsertResult.rows[0].id,
              contractId: contractInsertResult.rows[0].id,
              creationTransformations: JSON.stringify(creationTransformations),
              creationTransformationValues: creationTransformationValues || {},
              runtimeTransformations: JSON.stringify(runtimeTransformations),
              runtimeTransformationValues: runtimeTransformationValues || {},
              runtimeMatch,
              creationMatch,
            }
          );
        await AllianceDatabase.insertSourcifyMatch(this.sourcifyDatabasePool, {
          verifiedContractId: verifiedContractInsertResult.rows[0].id,
          creationMatch: match.creationMatch,
          runtimeMatch: match.runtimeMatch,
        });
      } catch (e) {
        logger.error(
          `Cannot insert verified_contract:\n${JSON.stringify({ match })}\n${e}`
        );
        return;
      }
    } else {
      // Until the Sourcify will decide a standard process to update:
      // if we have a "better match" always insert
      // "better match" = creation_transformations or runtime_transformations is better

      let needRuntimeMatchUpdate = false;
      let needCreationMatchUpdate = false;

      const existingCompiledContractIds: string[] = [];

      existingVerifiedContractResult.rows.forEach(
        (existingVerifiedContract) => {
          existingCompiledContractIds.push(
            existingVerifiedContract.compilation_id
          );
          const hasRuntimeAuxdataTransformation =
            existingVerifiedContract.runtime_transformations.some(
              (trans: Transformation) => trans.reason === "auxdata"
            );
          const hasCreationAuxdataTransformation =
            existingVerifiedContract.creation_transformations.some(
              (trans: Transformation) => trans.reason === "auxdata"
            );

          if (
            (hasRuntimeAuxdataTransformation &&
              match.runtimeMatch === "perfect") ||
            (existingVerifiedContract.runtime_match === false &&
              (match.runtimeMatch === "perfect" ||
                match.runtimeMatch === "partial"))
          ) {
            needRuntimeMatchUpdate = true;
          }

          if (
            (hasCreationAuxdataTransformation &&
              match.creationMatch === "perfect") ||
            (existingVerifiedContract.creation_match === false &&
              (match.creationMatch === "perfect" ||
                match.creationMatch === "partial"))
          ) {
            needCreationMatchUpdate = true;
          }
        }
      );

      if (needRuntimeMatchUpdate || needCreationMatchUpdate) {
        try {
          // Add recompiled bytecodes
          await AllianceDatabase.insertCode(this.sourcifyDatabasePool, {
            bytecodeHash: keccak256RecompiledCreationBytecode,
            bytecode: recompiledContract.creationBytecode,
          });
          await AllianceDatabase.insertCode(this.sourcifyDatabasePool, {
            bytecodeHash: keccak256RecompiledRuntimeBytecode,
            bytecode: recompiledContract.runtimeBytecode,
          });

          // insert new recompiled contract
          const compiledContractsInsertResult =
            await AllianceDatabase.insertCompiledContract(
              this.sourcifyDatabasePool,
              {
                compiler: recompiledContract.compiledPath,
                version: recompiledContract.compilerVersion,
                language,
                name: recompiledContract.name,
                fullyQualifiedName: `${compilationTargetPath}:${compilationTargetName}`,
                compilationArtifacts,
                sources: recompiledContract.solidity,
                compilerSettings: recompiledContract.metadata.settings,
                creationCodeHash: keccak256RecompiledCreationBytecode,
                runtimeCodeHash: keccak256RecompiledRuntimeBytecode,
                creationCodeArtifacts,
                runtimeCodeArtifacts,
              }
            );

          // Check if we are trying to insert a compiled contract that already exists
          // It could happen because of the check "needRuntimeMatchUpdate || needCreationMatchUpdate"
          // When the Sourcify will decide a standard process to update this check will be removed
          if (
            existingCompiledContractIds.includes(
              compiledContractsInsertResult.rows[0].id
            )
          ) {
            return;
          }

          // update verified contract with the newly added recompiled contract
          const verifiedContractInsertResult =
            await AllianceDatabase.insertVerifiedContract(
              this.sourcifyDatabasePool,
              {
                compilationId: compiledContractsInsertResult.rows[0].id,
                contractId: existingVerifiedContractResult.rows[0].contract_id,
                creationTransformations: JSON.stringify(
                  creationTransformations
                ),
                creationTransformationValues:
                  creationTransformationValues || {},
                runtimeTransformations: JSON.stringify(runtimeTransformations),
                runtimeTransformationValues: runtimeTransformationValues || {},
                runtimeMatch,
                creationMatch,
              }
            );

          await AllianceDatabase.insertSourcifyMatch(
            this.sourcifyDatabasePool,
            {
              verifiedContractId: verifiedContractInsertResult.rows[0].id,
              creationMatch: match.creationMatch,
              runtimeMatch: match.runtimeMatch,
            }
          );
        } catch (e) {
          logger.error(
            `Cannot update verified_contract:\n${JSON.stringify({
              match,
            })}\n${e}`
          );
          return;
        }
      }
    }
  }
}
