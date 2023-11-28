import {
  Match,
  CheckedContract,
  Transformation,
} from "@ethereum-sourcify/lib-sourcify";
import { logger } from "../../../common/loggerLoki";
import { id as keccak256str } from "ethers";
import { IStorageService } from "../StorageService";
import * as AllianceDatabase from "../utils/alliance-database-util";
import { AuthTypes, Connector } from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";

export interface AllianceDatabaseServiceOptions {
  googleCloudSql: {
    instanceName: string;
    iamAccount: string;
    database: string;
  };
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

export class AllianceDatabaseService implements IStorageService {
  private allianceDatabasePool?: any;

  googleCloudSqlInstanceName?: string;
  googleCloudSqlIamAccount?: string;
  googleCloudSqlDatabase?: string;
  postgresHost?: string;
  postgresPort?: number;
  postgresDatabase?: string;
  postgresUser?: string;
  postgresPassword?: string;

  constructor(options: AllianceDatabaseServiceOptions) {
    this.googleCloudSqlInstanceName = options.googleCloudSql.instanceName;
    this.googleCloudSqlIamAccount = options.googleCloudSql.iamAccount;
    this.googleCloudSqlDatabase = options.googleCloudSql.database;
    this.postgresHost = options.postgres.host;
    this.postgresPort = options.postgres.port;
    this.postgresDatabase = options.postgres.database;
    this.postgresUser = options.postgres.user;
    this.postgresPassword = options.postgres.password;
  }

  async init(): Promise<boolean> {
    // if the database is already initialized
    if (this.allianceDatabasePool != undefined) {
      return true;
    }

    if (this.googleCloudSqlInstanceName) {
      const connector = new Connector();
      const clientOpts = await connector.getOptions({
        instanceConnectionName: this.googleCloudSqlInstanceName, // "verifier-alliance:europe-west3:test-verifier-alliance",
        authType: AuthTypes.IAM,
      });
      this.allianceDatabasePool = new Pool({
        ...clientOpts,
        user: this.googleCloudSqlIamAccount, // "marco.castignoli@ethereum.org",
        database: this.googleCloudSqlDatabase, // "postgres",
        max: 5,
      });
    } else if (this.postgresHost) {
      this.allianceDatabasePool = new Pool({
        host: this.postgresHost,
        port: this.postgresPort,
        database: this.postgresDatabase,
        user: this.postgresUser,
        password: this.postgresPassword,
        max: 5,
      });
    } else {
      logger.warn("Alliance Database is disabled");
      return false;
    }
    logger.warn("Alliance Database is active");
    return true;
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
        this.allianceDatabasePool,
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
        await AllianceDatabase.insertCode(this.allianceDatabasePool, {
          bytecodeHash: keccak256RecompiledCreationBytecode,
          bytecode: recompiledContract.creationBytecode,
        });
        await AllianceDatabase.insertCode(this.allianceDatabasePool, {
          bytecodeHash: keccak256RecompiledRuntimeBytecode,
          bytecode: recompiledContract.runtimeBytecode,
        });

        // Add onchain bytecodes
        await AllianceDatabase.insertCode(this.allianceDatabasePool, {
          bytecodeHash: keccak256OnchainCreationBytecode,
          bytecode: match.onchainCreationBytecode,
        });
        await AllianceDatabase.insertCode(this.allianceDatabasePool, {
          bytecodeHash: keccak256OnchainRuntimeBytecode,
          bytecode: match.onchainRuntimeBytecode,
        });

        // Add the onchain contract in contracts
        const contractInsertResult = await AllianceDatabase.insertContract(
          this.allianceDatabasePool,
          {
            creationBytecodeHash: keccak256OnchainCreationBytecode,
            runtimeBytecodeHash: keccak256OnchainRuntimeBytecode,
          }
        );

        // add the onchain contract in contract_deployments
        await AllianceDatabase.insertContractDeployment(
          this.allianceDatabasePool,
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
            this.allianceDatabasePool,
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
        await AllianceDatabase.insertVerifiedContract(
          this.allianceDatabasePool,
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
      } catch (e) {
        logger.error(
          `Cannot insert verified_contract:\n${JSON.stringify({ match })}\n${e}`
        );
        return;
      }
    } else {
      // Until the Alliance will decide a standard process to update:
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
          await AllianceDatabase.insertCode(this.allianceDatabasePool, {
            bytecodeHash: keccak256RecompiledCreationBytecode,
            bytecode: recompiledContract.creationBytecode,
          });
          await AllianceDatabase.insertCode(this.allianceDatabasePool, {
            bytecodeHash: keccak256RecompiledRuntimeBytecode,
            bytecode: recompiledContract.runtimeBytecode,
          });

          // insert new recompiled contract
          const compiledContractsInsertResult =
            await AllianceDatabase.insertCompiledContract(
              this.allianceDatabasePool,
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
          // When the Alliance will decide a standard process to update this check will be removed
          if (
            existingCompiledContractIds.includes(
              compiledContractsInsertResult.rows[0].id
            )
          ) {
            return;
          }

          // update verified contract with the newly added recompiled contract
          await AllianceDatabase.insertVerifiedContract(
            this.allianceDatabasePool,
            {
              compilationId: compiledContractsInsertResult.rows[0].id,
              contractId: existingVerifiedContractResult.rows[0].contract_id,
              creationTransformations: JSON.stringify(creationTransformations),
              creationTransformationValues: creationTransformationValues || {},
              runtimeTransformations: JSON.stringify(runtimeTransformations),
              runtimeTransformationValues: runtimeTransformationValues || {},
              runtimeMatch,
              creationMatch,
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
