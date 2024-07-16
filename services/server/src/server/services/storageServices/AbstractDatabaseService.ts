import {
  Match,
  CheckedContract,
  Transformation,
} from "@ethereum-sourcify/lib-sourcify";
import { keccak256 } from "ethers";
import * as Database from "../utils/database-util";
import {
  bytesFromString,
  normalizeRecompiledBytecodes,
} from "../utils/database-util";
import { Pool, QueryResult } from "pg";
import { AuthTypes, Connector } from "@google-cloud/cloud-sql-connector";
import logger from "../../../common/logger";
import { Bytes, BytesKeccak, Nullable } from "../../types";

export interface DatabaseServiceOptions {
  googleCloudSql?: {
    instanceName: string;
    iamAccount: string;
    database: string;
  };
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

export default abstract class AbstractDatabaseService {
  abstract databasePool: Pool;
  abstract IDENTIFIER: string;

  googleCloudSqlInstanceName?: string;
  googleCloudSqlIamAccount?: string;
  googleCloudSqlDatabase?: string;
  postgresHost?: string;
  postgresPort?: number;
  postgresDatabase?: string;
  postgresUser?: string;
  postgresPassword?: string;

  constructor(options: DatabaseServiceOptions) {
    this.googleCloudSqlInstanceName = options.googleCloudSql?.instanceName;
    this.googleCloudSqlIamAccount = options.googleCloudSql?.iamAccount;
    this.googleCloudSqlDatabase = options.googleCloudSql?.database;
    this.postgresHost = options.postgres?.host;
    this.postgresPort = options.postgres?.port;
    this.postgresDatabase = options.postgres?.database;
    this.postgresUser = options.postgres?.user;
    this.postgresPassword = options.postgres?.password;
  }

  async init() {
    return await this.initDatabasePool();
  }

  async initDatabasePool(): Promise<boolean> {
    // if the database is already initialized
    if (this.databasePool != undefined) {
      return true;
    }

    logger.debug(`Initializing database pool for ${this.IDENTIFIER}`);

    if (this.googleCloudSqlInstanceName) {
      const connector = new Connector();
      const clientOpts = await connector.getOptions({
        instanceConnectionName: this.googleCloudSqlInstanceName, // "verifier-alliance:europe-west3:test-verifier-alliance",
        authType: AuthTypes.IAM,
      });
      this.databasePool = new Pool({
        ...clientOpts,
        user: this.googleCloudSqlIamAccount, // "marco.castignoli@ethereum.org",
        database: this.googleCloudSqlDatabase, // "postgres",
        max: 5,
      });
    } else if (this.postgresHost) {
      this.databasePool = new Pool({
        host: this.postgresHost,
        port: this.postgresPort,
        database: this.postgresDatabase,
        user: this.postgresUser,
        password: this.postgresPassword,
        max: 5,
      });
    } else {
      throw new Error("Alliance Database is disabled");
    }

    // Checking pool health before continuing
    try {
      logger.debug(`Checking database pool health for ${this.IDENTIFIER}`);
      await this.databasePool.query("SELECT 1;");
    } catch (error) {
      logger.error(`Cannot connect to ${this.IDENTIFIER}`, {
        host: this.postgresHost,
        port: this.postgresPort,
        database: this.postgresDatabase,
        user: this.postgresUser,
        error,
      });
      throw new Error(`Cannot connect to ${this.IDENTIFIER}`);
    }

    logger.info(`${this.IDENTIFIER} initialized`, {
      host: this.postgresHost,
      port: this.postgresPort,
      database: this.postgresDatabase,
    });
    return true;
  }

  validateBeforeStoring(
    recompiledContract: CheckedContract,
    match: Match,
  ): boolean {
    if (
      recompiledContract.runtimeBytecode === undefined ||
      recompiledContract.creationBytecode === undefined ||
      match.onchainRuntimeBytecode === undefined ||
      match.onchainCreationBytecode === undefined
    ) {
      throw new Error(
        `can only store contracts with both runtimeBytecode and creationBytecode address=${match.address} chainId=${match.chainId}`,
      );
    }
    if (match.creatorTxHash === undefined) {
      throw new Error(
        `can only store matches with creatorTxHash address=${match.address} chainId=${match.chainId}`,
      );
    }
    return true;
  }

  getKeccak256Bytecodes(recompiledContract: CheckedContract, match: Match) {
    if (recompiledContract.normalizedRuntimeBytecode === undefined) {
      throw new Error("normalizedRuntimeBytecode cannot be undefined");
    }
    if (match.onchainRuntimeBytecode === undefined) {
      throw new Error("onchainRuntimeBytecode cannot be undefined");
    }
    return {
      keccak256OnchainCreationBytecode: match.onchainCreationBytecode
        ? keccak256(bytesFromString(match.onchainCreationBytecode))
        : undefined,
      keccak256OnchainRuntimeBytecode: keccak256(
        bytesFromString(match.onchainRuntimeBytecode),
      ),
      keccak256RecompiledCreationBytecode:
        recompiledContract.normalizedCreationBytecode
          ? keccak256(
              bytesFromString(recompiledContract.normalizedCreationBytecode), // eslint-disable-line indent
            ) // eslint-disable-line indent
          : undefined,
      keccak256RecompiledRuntimeBytecode: keccak256(
        bytesFromString(recompiledContract.normalizedRuntimeBytecode),
      ),
    };
  }

  async getDatabaseColumns(
    recompiledContract: CheckedContract,
    match: Match,
  ): Promise<Database.DatabaseColumns> {
    const {
      keccak256OnchainCreationBytecode,
      keccak256OnchainRuntimeBytecode,
      keccak256RecompiledCreationBytecode,
      keccak256RecompiledRuntimeBytecode,
    } = this.getKeccak256Bytecodes(recompiledContract, match);

    const runtimeMatch =
      match.runtimeMatch === "perfect" || match.runtimeMatch === "partial";
    const creationMatch =
      match.creationMatch === "perfect" || match.creationMatch === "partial";

    const {
      runtimeTransformations,
      runtimeTransformationValues,
      creationTransformations,
      creationTransformationValues,
    } = match;

    // Force _transformations and _values to be null if not match
    // Force _transformations and _values to be not null if match
    let runtime_transformations = null;
    let runtime_values = null;
    if (runtimeMatch) {
      runtime_transformations = runtimeTransformations
        ? runtimeTransformations
        : [];
      runtime_values = runtimeTransformationValues
        ? runtimeTransformationValues
        : {};
    }
    let creation_transformations = null;
    let creation_values = null;
    if (creationMatch) {
      creation_transformations = creationTransformations
        ? creationTransformations
        : [];
      creation_values = creationTransformationValues
        ? creationTransformationValues
        : {};
    }

    const compilationTargetPath = Object.keys(
      recompiledContract.metadata.settings.compilationTarget,
    )[0];
    const compilationTargetName = Object.values(
      recompiledContract.metadata.settings.compilationTarget,
    )[0];
    const language = "solidity";
    const compilerOutput =
      recompiledContract.compilerOutput?.contracts[
        recompiledContract.compiledPath
      ][recompiledContract.name];

    if (!(await recompiledContract.generateCborAuxdataPositions())) {
      throw new Error(
        `cannot generate contract artifacts address=${match.address} chainId=${match.chainId}`,
      );
    }

    // Prepare compilation_artifacts.sources by removing everything except id
    let sources: Nullable<Database.CompilationArtifactsSources> = null;
    if (recompiledContract.compilerOutput?.sources) {
      sources = {};
      for (const source of Object.keys(
        recompiledContract.compilerOutput.sources,
      )) {
        sources[source] = {
          id: recompiledContract.compilerOutput.sources[source].id,
        };
      }
    }

    const compilationArtifacts = {
      abi: compilerOutput?.abi || null,
      userdoc: compilerOutput?.userdoc || null,
      devdoc: compilerOutput?.devdoc || null,
      storageLayout: compilerOutput?.storageLayout || null,
      sources,
    };
    const creationCodeArtifacts = {
      sourceMap: compilerOutput?.evm.bytecode.sourceMap || null,
      linkReferences: compilerOutput?.evm.bytecode.linkReferences || null,
      cborAuxdata: recompiledContract?.creationBytecodeCborAuxdata || null,
    };
    const runtimeCodeArtifacts = {
      sourceMap: compilerOutput?.evm.deployedBytecode?.sourceMap || null,
      linkReferences:
        compilerOutput?.evm.deployedBytecode?.linkReferences || null,
      immutableReferences:
        compilerOutput?.evm.deployedBytecode?.immutableReferences || null,
      cborAuxdata: recompiledContract?.runtimeBytecodeCborAuxdata || null,
    };

    // runtime bytecodes must exist
    if (recompiledContract.normalizedRuntimeBytecode === undefined) {
      throw new Error("Missing normalized runtime bytecode");
    }
    if (match.onchainRuntimeBytecode === undefined) {
      throw new Error("Missing onchain runtime bytecode");
    }

    let recompiledCreationCode:
      | Omit<Database.Tables.Code, "bytecode_hash">
      | undefined;
    if (
      recompiledContract.normalizedCreationBytecode &&
      keccak256RecompiledCreationBytecode
    ) {
      recompiledCreationCode = {
        bytecode_hash_keccak: bytesFromString<BytesKeccak>(
          keccak256RecompiledCreationBytecode,
        ),
        bytecode: bytesFromString<Bytes>(
          recompiledContract.normalizedCreationBytecode,
        ),
      };
    }

    let onchainCreationCode:
      | Omit<Database.Tables.Code, "bytecode_hash">
      | undefined;

    if (match.onchainCreationBytecode && keccak256OnchainCreationBytecode) {
      onchainCreationCode = {
        bytecode_hash_keccak: bytesFromString<BytesKeccak>(
          keccak256OnchainCreationBytecode,
        ),
        bytecode: bytesFromString<Bytes>(match.onchainCreationBytecode),
      };
    }

    return {
      recompiledCreationCode,
      recompiledRuntimeCode: {
        bytecode_hash_keccak: bytesFromString<BytesKeccak>(
          keccak256RecompiledRuntimeBytecode,
        ),
        bytecode: bytesFromString<Bytes>(
          recompiledContract.normalizedRuntimeBytecode,
        ),
      },
      onchainCreationCode,
      onchainRuntimeCode: {
        bytecode_hash_keccak: bytesFromString<BytesKeccak>(
          keccak256OnchainRuntimeBytecode,
        ),
        bytecode: bytesFromString<Bytes>(match.onchainRuntimeBytecode),
      },
      contractDeployment: {
        chain_id: match.chainId,
        address: bytesFromString(match.address),
        transaction_hash: bytesFromString(match.creatorTxHash),
        block_number: match.blockNumber,
        txindex: match.txIndex,
        deployer: bytesFromString(match.deployer),
      },
      compiledContract: {
        language,
        compiler: "solc",
        compiler_settings: Database.prepareCompilerSettings(recompiledContract),
        name: recompiledContract.name,
        sources: recompiledContract.solidity,
        version: recompiledContract.compilerVersion,
        fully_qualified_name: `${compilationTargetPath}:${compilationTargetName}`,
        compilation_artifacts: compilationArtifacts,
        creation_code_artifacts: creationCodeArtifacts,
        runtime_code_artifacts: runtimeCodeArtifacts,
      },
      verifiedContract: {
        runtime_transformations,
        creation_transformations,
        runtime_values,
        creation_values,
        runtime_match: runtimeMatch,
        creation_match: creationMatch,
        // We cover also no-metadata case by using match === "perfect"
        runtime_metadata_match: match.runtimeMatch === "perfect",
        creation_metadata_match: match.creationMatch === "perfect",
      },
    };
  }

  async insertNewVerifiedContract(
    recompiledContract: CheckedContract,
    match: Match,
    databaseColumns: Database.DatabaseColumns,
  ): Promise<number> {
    try {
      let recompiledCreationCodeInsertResult:
        | QueryResult<Pick<Database.Tables.Code, "bytecode_hash">>
        | undefined;
      let onchainCreationCodeInsertResult:
        | QueryResult<Pick<Database.Tables.Code, "bytecode_hash">>
        | undefined;

      // Add recompiled bytecodes
      if (databaseColumns.recompiledCreationCode) {
        recompiledCreationCodeInsertResult = await Database.insertCode(
          this.databasePool,
          databaseColumns.recompiledCreationCode,
        );
      }
      const recompiledRuntimeCodeInsertResult = await Database.insertCode(
        this.databasePool,
        databaseColumns.recompiledRuntimeCode,
      );

      // Add onchain bytecodes
      if (databaseColumns.onchainCreationCode) {
        onchainCreationCodeInsertResult = await Database.insertCode(
          this.databasePool,
          databaseColumns.onchainCreationCode,
        );
      }
      const onchainRuntimeCodeInsertResult = await Database.insertCode(
        this.databasePool,
        databaseColumns.onchainRuntimeCode,
      );

      // Add the onchain contract in contracts
      const contractInsertResult = await Database.insertContract(
        this.databasePool,
        {
          creation_bytecode_hash:
            onchainCreationCodeInsertResult?.rows[0].bytecode_hash,
          runtime_bytecode_hash:
            onchainRuntimeCodeInsertResult.rows[0].bytecode_hash,
        },
      );

      // add the onchain contract in contract_deployments
      const contractDeploymentInsertResult =
        await Database.insertContractDeployment(this.databasePool, {
          ...databaseColumns.contractDeployment,
          contract_id: contractInsertResult.rows[0].id,
        });

      // insert new recompiled contract
      const compiledContractsInsertResult =
        await Database.insertCompiledContract(this.databasePool, {
          ...databaseColumns.compiledContract,
          creation_code_hash:
            recompiledCreationCodeInsertResult?.rows[0].bytecode_hash,
          runtime_code_hash:
            recompiledRuntimeCodeInsertResult.rows[0].bytecode_hash,
        });

      // insert new recompiled contract with newly added contract and compiledContract
      const verifiedContractInsertResult =
        await Database.insertVerifiedContract(this.databasePool, {
          ...databaseColumns.verifiedContract,
          compilation_id: compiledContractsInsertResult.rows[0].id,
          deployment_id: contractDeploymentInsertResult.rows[0].id,
        });
      return verifiedContractInsertResult.rows[0].id;
    } catch (e) {
      throw new Error(
        `cannot insert verified_contract address=${match.address} chainId=${match.chainId}\n${e}`,
      );
    }
  }

  async updateExistingVerifiedContract(
    existingVerifiedContractResult: Database.GetVerifiedContractByChainAndAddressResult[],
    recompiledContract: CheckedContract,
    match: Match,
    databaseColumns: Database.DatabaseColumns,
  ): Promise<number | false> {
    // runtime bytecodes must exist
    if (recompiledContract.normalizedRuntimeBytecode === undefined) {
      throw new Error("Missing normalized runtime bytecode");
    }
    if (match.onchainRuntimeBytecode === undefined) {
      throw new Error("Missing onchain runtime bytecode");
    }

    let needRuntimeMatchUpdate = false;
    let needCreationMatchUpdate = false;

    existingVerifiedContractResult.forEach((existingVerifiedContract) => {
      // Check if we need to do an update. We need an update if:
      // - We had a partial match (i.e. runtime_metadata_match=false) and now we have perfect match
      // OR
      // - We didn't have any runtime match and now we have any type of a match
      if (
        (!existingVerifiedContract.runtime_metadata_match &&
          match.runtimeMatch === "perfect") ||
        (existingVerifiedContract.runtime_match === false &&
          (match.runtimeMatch === "perfect" ||
            match.runtimeMatch === "partial"))
      ) {
        needRuntimeMatchUpdate = true;
      }

      // Same above but for creation
      if (
        (!existingVerifiedContract.creation_metadata_match &&
          match.creationMatch === "perfect") ||
        (existingVerifiedContract.creation_match === false &&
          (match.creationMatch === "perfect" ||
            match.creationMatch === "partial"))
      ) {
        needCreationMatchUpdate = true;
      }
    });

    if (!needRuntimeMatchUpdate && !needCreationMatchUpdate) {
      return false;
    }
    try {
      let recompiledCreationCodeInsertResult:
        | QueryResult<Pick<Database.Tables.Code, "bytecode_hash">>
        | undefined;
      let onchainCreationCodeInsertResult:
        | QueryResult<Pick<Database.Tables.Code, "bytecode_hash">>
        | undefined;
      // Check if contracts_deployed needs to be updated
      if (
        existingVerifiedContractResult[0].transaction_hash === null &&
        match.creatorTxHash != null &&
        databaseColumns.onchainCreationCode
      ) {
        onchainCreationCodeInsertResult = await Database.insertCode(
          this.databasePool,
          databaseColumns.onchainCreationCode,
        );

        const onchainRuntimeCodeInsertResult = await Database.insertCode(
          this.databasePool,
          databaseColumns.onchainRuntimeCode,
        );

        // Add the onchain contract in contracts
        const contractInsertResult = await Database.insertContract(
          this.databasePool,
          {
            creation_bytecode_hash:
              onchainCreationCodeInsertResult.rows[0].bytecode_hash,
            runtime_bytecode_hash:
              onchainRuntimeCodeInsertResult.rows[0].bytecode_hash,
          },
        );

        // add the onchain contract in contract_deployments
        await Database.updateContractDeployment(this.databasePool, {
          ...databaseColumns.contractDeployment,
          contract_id: contractInsertResult.rows[0].id,
          id: existingVerifiedContractResult[0].deployment_id,
        });
      }

      // Add recompiled bytecodes
      if (
        recompiledContract.normalizedCreationBytecode &&
        databaseColumns.recompiledCreationCode
      ) {
        recompiledCreationCodeInsertResult = await Database.insertCode(
          this.databasePool,
          databaseColumns.recompiledCreationCode,
        );
      }
      const recompiledRuntimeCodeInsertResult = await Database.insertCode(
        this.databasePool,
        databaseColumns.recompiledRuntimeCode,
      );

      // insert new recompiled contract
      const compiledContractsInsertResult =
        await Database.insertCompiledContract(this.databasePool, {
          ...databaseColumns.compiledContract,
          creation_code_hash:
            recompiledCreationCodeInsertResult?.rows[0].bytecode_hash,
          runtime_code_hash:
            recompiledRuntimeCodeInsertResult.rows[0].bytecode_hash,
        });

      // update verified contract with the newly added recompiled contract
      const verifiedContractInsertResult =
        await Database.insertVerifiedContract(this.databasePool, {
          ...databaseColumns.verifiedContract,
          compilation_id: compiledContractsInsertResult.rows[0].id,
          deployment_id: existingVerifiedContractResult[0].deployment_id,
        });

      return verifiedContractInsertResult.rows[0].id;
    } catch (e) {
      throw new Error(
        `cannot update verified_contract address=${match.address} chainId=${match.chainId}\n${e}`,
      );
    }
  }

  async insertOrUpdateVerifiedContract(
    recompiledContract: CheckedContract,
    match: Match,
  ): Promise<{
    type: "update" | "insert";
    verifiedContractId: number | false;
    oldVerifiedContractId?: number;
  }> {
    this.validateBeforeStoring(recompiledContract, match);

    await this.initDatabasePool();

    // Normalize both creation and runtime recompiled bytecodes before storing them to the database
    normalizeRecompiledBytecodes(recompiledContract, match);

    const databaseColumns = await this.getDatabaseColumns(
      recompiledContract,
      match,
    );

    // Get all the verified contracts existing in the Database for these exact onchain bytecodes.
    const existingVerifiedContractResult =
      await Database.getVerifiedContractByChainAndAddress(
        this.databasePool,
        parseInt(match.chainId),
        bytesFromString(match.address)!,
      );

    if (existingVerifiedContractResult.rowCount === 0) {
      return {
        type: "insert",
        verifiedContractId: await this.insertNewVerifiedContract(
          recompiledContract,
          match,
          databaseColumns,
        ),
      };
    } else {
      return {
        type: "update",
        verifiedContractId: await this.updateExistingVerifiedContract(
          existingVerifiedContractResult.rows,
          recompiledContract,
          match,
          databaseColumns,
        ),
        oldVerifiedContractId: existingVerifiedContractResult.rows[0].id,
      };
    }
  }
}
