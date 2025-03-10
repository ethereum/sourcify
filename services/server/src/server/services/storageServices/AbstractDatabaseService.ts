import { Verification } from "@ethereum-sourcify/lib-sourcify";
import * as DatabaseUtil from "../utils/database-util";
import { bytesFromString } from "../utils/database-util";
import { Database, DatabaseOptions } from "../utils/Database";
import { QueryResult } from "pg";

export default abstract class AbstractDatabaseService {
  public database: Database;
  abstract IDENTIFIER: string;

  constructor(options: DatabaseOptions) {
    this.database = new Database(options);
  }

  async init() {
    return await this.database.initDatabasePool(this.IDENTIFIER);
  }

  validateVerificationBeforeStoring(verification: Verification): boolean {
    if (
      verification.compilation.runtimeBytecode === undefined ||
      verification.compilation.creationBytecode === undefined ||
      verification.status.runtimeMatch === undefined ||
      verification.status.creationMatch === undefined
    ) {
      throw new Error(
        `can only store contracts with both runtimeBytecode and creationBytecode address=${verification.address} chainId=${verification.chainId}`,
      );
    }
    if (verification.deploymentInfo.txHash === undefined) {
      throw new Error(
        `can only store matches with creatorTxHash address=${verification.address} chainId=${verification.chainId}`,
      );
    }
    return true;
  }

  async insertNewVerifiedContract(
    databaseColumns: DatabaseUtil.DatabaseColumns,
  ): Promise<string> {
    // Get a client from the pool, so that we can execute all the insert queries within the same transaction
    const client = await this.database.pool.connect();

    try {
      // Start the sql transaction
      await client.query("BEGIN");
      let recompiledCreationCodeInsertResult:
        | QueryResult<Pick<DatabaseUtil.Tables.Code, "bytecode_hash">>
        | undefined;
      let onchainCreationCodeInsertResult:
        | QueryResult<Pick<DatabaseUtil.Tables.Code, "bytecode_hash">>
        | undefined;

      // Add recompiled bytecodes
      if (databaseColumns.recompiledCreationCode) {
        recompiledCreationCodeInsertResult = await this.database.insertCode(
          client,
          databaseColumns.recompiledCreationCode,
        );
      }
      const recompiledRuntimeCodeInsertResult = await this.database.insertCode(
        client,
        databaseColumns.recompiledRuntimeCode,
      );

      // Add onchain bytecodes
      if (databaseColumns.onchainCreationCode) {
        onchainCreationCodeInsertResult = await this.database.insertCode(
          client,
          databaseColumns.onchainCreationCode,
        );
      }
      const onchainRuntimeCodeInsertResult = await this.database.insertCode(
        client,
        databaseColumns.onchainRuntimeCode,
      );

      // Add the onchain contract in contracts
      const contractInsertResult = await this.database.insertContract(client, {
        creation_bytecode_hash:
          onchainCreationCodeInsertResult?.rows[0].bytecode_hash,
        runtime_bytecode_hash:
          onchainRuntimeCodeInsertResult.rows[0].bytecode_hash,
      });

      // add the onchain contract in contract_deployments
      const contractDeploymentInsertResult =
        await this.database.insertContractDeployment(client, {
          ...databaseColumns.contractDeployment,
          contract_id: contractInsertResult.rows[0].id,
        });

      // insert new recompiled contract
      const compiledContractsInsertResult =
        await this.database.insertCompiledContract(client, {
          ...databaseColumns.compiledContract,
          creation_code_hash:
            recompiledCreationCodeInsertResult?.rows[0].bytecode_hash,
          runtime_code_hash:
            recompiledRuntimeCodeInsertResult.rows[0].bytecode_hash,
        });

      const compiledContractId = compiledContractsInsertResult.rows[0].id;

      await this.database.insertCompiledContractsSources(client, {
        sourcesInformation: databaseColumns.sourcesInformation,
        compilation_id: compiledContractId,
      });

      // insert new recompiled contract with newly added contract and compiledContract
      const verifiedContractInsertResult =
        await this.database.insertVerifiedContract(client, {
          ...databaseColumns.verifiedContract,
          compilation_id: compiledContractId,
          deployment_id: contractDeploymentInsertResult.rows[0].id,
        });
      // Commit the transaction
      await client.query("COMMIT");
      return verifiedContractInsertResult.rows[0].id;
    } catch (e) {
      // Rollback the transaction in case of error
      await client.query("ROLLBACK");
      throw new Error(
        `cannot insert verified_contract address=${databaseColumns.contractDeployment.address} chainId=${databaseColumns.contractDeployment.chain_id}\n${e}`,
      );
    } finally {
      client.release();
    }
  }

  async updateExistingVerifiedContract(
    existingVerifiedContractResult: DatabaseUtil.GetVerifiedContractByChainAndAddressResult[],
    databaseColumns: DatabaseUtil.DatabaseColumns,
  ): Promise<string | false> {
    // runtime bytecodes must exist
    if (databaseColumns.recompiledRuntimeCode.bytecode === undefined) {
      throw new Error("Missing normalized runtime bytecode");
    }
    if (databaseColumns.onchainRuntimeCode.bytecode === undefined) {
      throw new Error("Missing onchain runtime bytecode");
    }

    // Get a client from the pool, so that we can execute all the insert queries within the same transaction
    const client = await this.database.pool.connect();
    try {
      // Start the sql transaction
      await client.query("BEGIN");

      let recompiledCreationCodeInsertResult:
        | QueryResult<Pick<DatabaseUtil.Tables.Code, "bytecode_hash">>
        | undefined;
      let onchainCreationCodeInsertResult:
        | QueryResult<Pick<DatabaseUtil.Tables.Code, "bytecode_hash">>
        | undefined;
      // Check if contracts_deployed needs to be updated
      if (
        existingVerifiedContractResult[0].transaction_hash === null &&
        databaseColumns.contractDeployment.transaction_hash != null &&
        databaseColumns.onchainCreationCode
      ) {
        onchainCreationCodeInsertResult = await this.database.insertCode(
          client,
          databaseColumns.onchainCreationCode,
        );

        const onchainRuntimeCodeInsertResult = await this.database.insertCode(
          client,
          databaseColumns.onchainRuntimeCode,
        );

        // Add the onchain contract in contracts
        const contractInsertResult = await this.database.insertContract(
          client,
          {
            creation_bytecode_hash:
              onchainCreationCodeInsertResult.rows[0].bytecode_hash,
            runtime_bytecode_hash:
              onchainRuntimeCodeInsertResult.rows[0].bytecode_hash,
          },
        );

        // add the onchain contract in contract_deployments
        await this.database.updateContractDeployment(client, {
          ...databaseColumns.contractDeployment,
          contract_id: contractInsertResult.rows[0].id,
          id: existingVerifiedContractResult[0].deployment_id,
        });
      }

      // Add recompiled bytecodes
      if (databaseColumns.recompiledCreationCode) {
        recompiledCreationCodeInsertResult = await this.database.insertCode(
          client,
          databaseColumns.recompiledCreationCode,
        );
      }
      const recompiledRuntimeCodeInsertResult = await this.database.insertCode(
        client,
        databaseColumns.recompiledRuntimeCode,
      );

      // insert new recompiled contract
      const compiledContractsInsertResult =
        await this.database.insertCompiledContract(client, {
          ...databaseColumns.compiledContract,
          creation_code_hash:
            recompiledCreationCodeInsertResult?.rows[0].bytecode_hash,
          runtime_code_hash:
            recompiledRuntimeCodeInsertResult.rows[0].bytecode_hash,
        });

      const compiledContractId = compiledContractsInsertResult.rows[0].id;

      await this.database.insertCompiledContractsSources(client, {
        sourcesInformation: databaseColumns.sourcesInformation,
        compilation_id: compiledContractId,
      });

      // update verified contract with the newly added recompiled contract
      const verifiedContractInsertResult =
        await this.database.insertVerifiedContract(client, {
          ...databaseColumns.verifiedContract,
          compilation_id: compiledContractsInsertResult.rows[0].id,
          deployment_id: existingVerifiedContractResult[0].deployment_id,
        });

      // Commit the transaction
      await client.query("COMMIT");
      return verifiedContractInsertResult.rows[0].id;
    } catch (e) {
      // Rollback the transaction in case of error
      await client.query("ROLLBACK");
      throw new Error(
        `cannot update verified_contract address=${databaseColumns.contractDeployment.address} chainId=${databaseColumns.contractDeployment.chain_id}\n${e}`,
      );
    } finally {
      client.release();
    }
  }

  async insertOrUpdateVerification(verification: Verification): Promise<{
    type: "update" | "insert";
    verifiedContractId: string | false;
    oldVerifiedContractId?: string;
  }> {
    this.validateVerificationBeforeStoring(verification);

    await this.init();

    const databaseColumns =
      await DatabaseUtil.getDatabaseColumnsFromVerification(verification);

    // Get all the verified contracts existing in the DatabaseUtil for these exact onchain bytecodes.
    const existingVerifiedContractResult =
      await this.database.getVerifiedContractByChainAndAddress(
        verification.chainId,
        bytesFromString(verification.address)!,
      );

    if (existingVerifiedContractResult.rowCount === 0) {
      return {
        type: "insert",
        verifiedContractId:
          await this.insertNewVerifiedContract(databaseColumns),
      };
    } else {
      return {
        type: "update",
        verifiedContractId: await this.updateExistingVerifiedContract(
          existingVerifiedContractResult.rows,
          databaseColumns,
        ),
        oldVerifiedContractId: existingVerifiedContractResult.rows[0].id,
      };
    }
  }
}
