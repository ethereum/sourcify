import {
  Match,
  CheckedContract,
  Transformation,
} from "@ethereum-sourcify/lib-sourcify";
import { id as keccak256str } from "ethers";
import * as Database from "../utils/database-util";
import { Pool } from "pg";

export default abstract class AbstractDatabaseService {
  abstract init(): Promise<boolean>;
  abstract databasePool: Pool;
  abstract databaseName: string;

  validateBeforeStoring(
    recompiledContract: CheckedContract,
    match: Match
  ): boolean {
    if (
      recompiledContract.runtimeBytecode === undefined ||
      recompiledContract.creationBytecode === undefined ||
      match.onchainRuntimeBytecode === undefined ||
      match.onchainCreationBytecode === undefined
    ) {
      throw new Error(
        `can only store contracts with both runtimeBytecode and creationBytecode address=${match.address} chainId=${match.chainId}`
      );
    }
    if (match.creatorTxHash === undefined) {
      throw new Error(
        `can only store matches with creatorTxHash address=${match.address} chainId=${match.chainId}`
      );
    }
    return true;
  }

  getKeccak256Bytecodes(recompiledContract: CheckedContract, match: Match) {
    return {
      keccak256OnchainCreationBytecode: keccak256str(
        match.onchainCreationBytecode!
      ),
      keccak256OnchainRuntimeBytecode: keccak256str(
        match.onchainRuntimeBytecode!
      ),
      keccak256RecompiledCreationBytecode: keccak256str(
        recompiledContract.creationBytecode!
      ),
      keccak256RecompiledRuntimeBytecode: keccak256str(
        recompiledContract.runtimeBytecode!
      ),
    };
  }

  async getDatabaseColumns(
    recompiledContract: CheckedContract,
    match: Match
  ): Promise<Database.DatabaseColumns> {
    const {
      keccak256OnchainCreationBytecode,
      keccak256OnchainRuntimeBytecode,
      keccak256RecompiledCreationBytecode,
      keccak256RecompiledRuntimeBytecode,
    } = this.getKeccak256Bytecodes(recompiledContract, match);

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

    if (!(await recompiledContract.generateCborAuxdataPositions())) {
      throw new Error(
        `cannot generate contract artifacts address=${match.address} chainId=${match.chainId}`
      );
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
      cborAuxdata: recompiledContract?.creationBytecodeCborAuxdata,
    };
    const runtimeCodeArtifacts = {
      sourceMap: compilerOutput?.evm.deployedBytecode?.sourceMap || "",
      linkReferences:
        compilerOutput?.evm.deployedBytecode?.linkReferences || {},
      immutableReferences:
        compilerOutput?.evm.deployedBytecode?.immutableReferences || {},
      cborAuxdata: recompiledContract?.runtimeBytecodeCborAuxdata,
    };

    const runtimeMatch =
      match.runtimeMatch === "perfect" || match.runtimeMatch === "partial";
    const creationMatch =
      match.creationMatch === "perfect" || match.creationMatch === "partial";

    return {
      keccak256OnchainCreationBytecode,
      keccak256OnchainRuntimeBytecode,
      keccak256RecompiledCreationBytecode,
      keccak256RecompiledRuntimeBytecode,
      runtimeTransformations,
      runtimeTransformationValues,
      creationTransformations,
      creationTransformationValues,
      compilationTargetPath,
      compilationTargetName,
      language,
      compilationArtifacts,
      creationCodeArtifacts,
      runtimeCodeArtifacts,
      runtimeMatch,
      creationMatch,
    };
  }

  async insertNewVerifiedContract(
    recompiledContract: CheckedContract,
    match: Match,
    databaseColumns: Database.DatabaseColumns
  ) {
    try {
      // Add recompiled bytecodes
      await Database.insertCode(this.databasePool, {
        bytecodeHash: databaseColumns.keccak256RecompiledCreationBytecode,
        bytecode: recompiledContract.creationBytecode!,
      });
      await Database.insertCode(this.databasePool, {
        bytecodeHash: databaseColumns.keccak256RecompiledRuntimeBytecode,
        bytecode: recompiledContract.runtimeBytecode!,
      });

      // Add onchain bytecodes
      await Database.insertCode(this.databasePool, {
        bytecodeHash: databaseColumns.keccak256OnchainCreationBytecode,
        bytecode: match.onchainCreationBytecode!,
      });
      await Database.insertCode(this.databasePool, {
        bytecodeHash: databaseColumns.keccak256OnchainRuntimeBytecode,
        bytecode: match.onchainRuntimeBytecode!,
      });

      // Add the onchain contract in contracts
      const contractInsertResult = await Database.insertContract(
        this.databasePool,
        {
          creationBytecodeHash:
            databaseColumns.keccak256OnchainCreationBytecode,
          runtimeBytecodeHash: databaseColumns.keccak256OnchainRuntimeBytecode,
        }
      );

      // add the onchain contract in contract_deployments
      await Database.insertContractDeployment(this.databasePool, {
        chainId: match.chainId,
        address: match.address,
        transactionHash: match.creatorTxHash!,
        contractId: contractInsertResult.rows[0].id,
      });

      // insert new recompiled contract
      const compiledContractsInsertResult =
        await Database.insertCompiledContract(this.databasePool, {
          compiler: recompiledContract.compiledPath,
          version: recompiledContract.compilerVersion,
          language: databaseColumns.language,
          name: recompiledContract.name,
          fullyQualifiedName: `${databaseColumns.compilationTargetPath}:${databaseColumns.compilationTargetName}`,
          compilationArtifacts: databaseColumns.compilationArtifacts,
          sources: recompiledContract.solidity,
          compilerSettings: recompiledContract.metadata.settings,
          creationCodeHash: databaseColumns.keccak256RecompiledCreationBytecode,
          runtimeCodeHash: databaseColumns.keccak256RecompiledRuntimeBytecode,
          creationCodeArtifacts: databaseColumns.creationCodeArtifacts,
          runtimeCodeArtifacts: databaseColumns.runtimeCodeArtifacts,
        });

      // insert new recompiled contract with newly added contract and compiledContract
      const verifiedContractInsertResult =
        await Database.insertVerifiedContract(this.databasePool, {
          compilationId: compiledContractsInsertResult.rows[0].id,
          contractId: contractInsertResult.rows[0].id,
          creationTransformations: JSON.stringify(
            databaseColumns.creationTransformations
          ),
          creationTransformationValues:
            databaseColumns.creationTransformationValues || {},
          runtimeTransformations: JSON.stringify(
            databaseColumns.runtimeTransformations
          ),
          runtimeTransformationValues:
            databaseColumns.runtimeTransformationValues || {},
          runtimeMatch: databaseColumns.runtimeMatch,
          creationMatch: databaseColumns.creationMatch,
        });
      return verifiedContractInsertResult.rows[0].id;
    } catch (e) {
      throw new Error(
        `cannot insert verified_contract address=${match.address} chainId=${match.chainId}\n${e}`
      );
    }
  }

  async updateExistingVerifiedContract(
    existingVerifiedContractResult: any,
    recompiledContract: CheckedContract,
    match: Match,
    databaseColumns: Database.DatabaseColumns
  ) {
    // Until the Sourcify will decide a standard process to update:
    // if we have a "better match" always insert
    // "better match" = creation_transformations or runtime_transformations is better

    let needRuntimeMatchUpdate = false;
    let needCreationMatchUpdate = false;

    const existingCompiledContractIds: string[] = [];

    existingVerifiedContractResult.rows.forEach(
      (existingVerifiedContract: any) => {
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
        await Database.insertCode(this.databasePool, {
          bytecodeHash: databaseColumns.keccak256RecompiledCreationBytecode,
          bytecode: recompiledContract.creationBytecode!,
        });
        await Database.insertCode(this.databasePool, {
          bytecodeHash: databaseColumns.keccak256RecompiledRuntimeBytecode,
          bytecode: recompiledContract.runtimeBytecode!,
        });

        // insert new recompiled contract
        const compiledContractsInsertResult =
          await Database.insertCompiledContract(this.databasePool, {
            compiler: recompiledContract.compiledPath,
            version: recompiledContract.compilerVersion,
            language: databaseColumns.language,
            name: recompiledContract.name,
            fullyQualifiedName: `${databaseColumns.compilationTargetPath}:${databaseColumns.compilationTargetName}`,
            compilationArtifacts: databaseColumns.compilationArtifacts,
            sources: recompiledContract.solidity,
            compilerSettings: recompiledContract.metadata.settings,
            creationCodeHash:
              databaseColumns.keccak256RecompiledCreationBytecode,
            runtimeCodeHash: databaseColumns.keccak256RecompiledRuntimeBytecode,
            creationCodeArtifacts: databaseColumns.creationCodeArtifacts,
            runtimeCodeArtifacts: databaseColumns.runtimeCodeArtifacts,
          });

        // Check if we are trying to insert a compiled contract that already exists
        // It could happen because of the check "needRuntimeMatchUpdate || needCreationMatchUpdate"
        // When the Sourcify will decide a standard process to update this check will be removed
        if (
          existingCompiledContractIds.includes(
            compiledContractsInsertResult.rows[0].id
          )
        ) {
          return false;
        }

        // update verified contract with the newly added recompiled contract
        const verifiedContractInsertResult =
          await Database.insertVerifiedContract(this.databasePool, {
            compilationId: compiledContractsInsertResult.rows[0].id,
            contractId: existingVerifiedContractResult.rows[0].contract_id,
            creationTransformations: JSON.stringify(
              databaseColumns.creationTransformations
            ),
            creationTransformationValues:
              databaseColumns.creationTransformationValues || {},
            runtimeTransformations: JSON.stringify(
              databaseColumns.runtimeTransformations
            ),
            runtimeTransformationValues:
              databaseColumns.runtimeTransformationValues || {},
            runtimeMatch: databaseColumns.runtimeMatch,
            creationMatch: databaseColumns.creationMatch,
          });

        return verifiedContractInsertResult.rows[0].id;
      } catch (e) {
        throw new Error(
          `cannot update verified_contract address=${match.address} chainId=${match.chainId}\n${e}`
        );
      }
    }
  }

  async storeMatch(recompiledContract: CheckedContract, match: Match) {
    this.validateBeforeStoring(recompiledContract, match);

    await this.init();

    const databaseColumns = await this.getDatabaseColumns(
      recompiledContract,
      match
    );

    // Get all the verified contracts existing in the Database for these exact onchain bytecodes.
    const existingVerifiedContractResult =
      await Database.getVerifiedContractByBytecodeHashes(
        this.databasePool,
        databaseColumns.keccak256OnchainRuntimeBytecode,
        databaseColumns.keccak256OnchainCreationBytecode
      );

    if (existingVerifiedContractResult.rowCount === 0) {
      await this.insertNewVerifiedContract(
        recompiledContract,
        match,
        databaseColumns
      );
    } else {
      await this.updateExistingVerifiedContract(
        existingVerifiedContractResult,
        recompiledContract,
        match,
        databaseColumns
      );
    }
  }
}
