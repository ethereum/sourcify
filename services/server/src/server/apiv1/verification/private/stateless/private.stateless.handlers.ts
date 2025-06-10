import { Response } from "express";
import { LegacyVerifyRequest, extractFiles } from "../../verification.common";
import {
  ISolidityCompiler,
  SolidityMetadataContract,
  createMetadataContractsFromFiles,
  Verification,
} from "@ethereum-sourcify/lib-sourcify";
import { BadRequestError, NotFoundError } from "../../../../../common/errors";
import { StatusCodes } from "http-status-codes";
import { Services } from "../../../../services/services";
import { ChainRepository } from "../../../../../sourcify-chain-repository";
import logger from "../../../../../common/logger";
import { getApiV1ResponseFromVerification } from "../../../controllers.common";
import { DatabaseCompilation } from "../../../../services/utils/DatabaseCompilation";

export async function verifyDeprecated(
  req: LegacyVerifyRequest,
  res: Response,
): Promise<any> {
  const solc = req.app.get("solc") as ISolidityCompiler;
  const services = req.app.get("services") as Services;
  const chainRepository = req.app.get("chainRepository") as ChainRepository;

  const inputFiles = extractFiles(req);
  if (!inputFiles) {
    const msg =
      "Couldn't extract files from the request. Please make sure you have added files";
    throw new NotFoundError(msg);
  }

  let metadataContracts: SolidityMetadataContract[];
  try {
    metadataContracts = await createMetadataContractsFromFiles(inputFiles);
  } catch (error: any) {
    throw new BadRequestError(error.message);
  }

  if (metadataContracts.length !== 1 && !req.body?.chosenContract) {
    const contractNames = metadataContracts.map((c) => c.name).join(", ");
    const msg = `Detected ${metadataContracts.length} contracts (${contractNames}), but can only verify 1 at a time. Please choose a main contract and click Verify again.`;
    const contractsToChoose = metadataContracts.map((contract) => ({
      name: contract.name,
      path: contract.path,
    }));
    return res
      .status(StatusCodes.BAD_REQUEST)
      .send({ error: msg, contractsToChoose });
  }

  const contract: SolidityMetadataContract = req.body?.chosenContract
    ? metadataContracts[req.body?.chosenContract]
    : metadataContracts[0];

  if (!contract) {
    throw new NotFoundError(
      "Chosen contract not found. Received chosenContract: " +
        req.body?.chosenContract,
    );
  }

  // Fetch missing files
  try {
    await contract.fetchMissing();
  } catch (error: any) {
    logger.debug("Error fetching missing files", {
      error: error,
    });
  }

  const stringifyInvalidAndMissing = (contract: SolidityMetadataContract) => {
    const errors = Object.keys(contract.invalidSources).concat(
      Object.keys(contract.missingSources),
    );
    return `${contract.name} (${errors.join(", ")})`;
  };

  if (!contract.isCompilable()) {
    throw new BadRequestError(
      "Invalid or missing sources in:\n" + stringifyInvalidAndMissing(contract),
    );
  }

  try {
    // Create a compilation from the contract and compile it
    const compilation = await contract.createCompilation(solc);

    // We need to compile the compilation before creating the Verification object
    // because we are not going to call verify() on the Verification object
    await compilation.compile();
    // We don't expect `generateCborAuxdataPositions` to throw an error, so let's throw it if it does
    // We don't need to log a specific error here because this function is not called by users
    await compilation.generateCborAuxdataPositions();

    // Create a mock Verification object for deprecated chains
    const verification = new Verification(
      compilation,
      chainRepository.sourcifyChainMap[req.body.chain],
      req.body.address,
      req.body.creatorTxHash,
    );

    // Override verification properties for deprecated chains
    // The hexadecimal string is '!!!!!!!!! - chain was deprecated at the time of verification'
    const deprecatedMessage =
      "0x2121212121212121212121202d20636861696e207761732064657072656361746564206174207468652074696d65206f6620766572696669636174696f6e";

    // Set status based on request match type
    (verification as any).runtimeMatch = req.body.match;
    (verification as any).creationMatch = req.body.match;

    // Set mock bytecodes
    (verification as any)._onchainRuntimeBytecode = deprecatedMessage;
    (verification as any)._onchainCreationBytecode = deprecatedMessage;

    // Set deployment info
    (verification as any).blockNumber = -1;
    (verification as any).creatorTxHash = undefined; // null bytea
    (verification as any).txIndex = -1;
    (verification as any).deployer = undefined; // null bytea

    // Store the verification
    await services.storage.storeVerification(verification.export());

    res.send({
      result: [getApiV1ResponseFromVerification(verification)],
    });
  } catch (error: any) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send({ error: error.message });
  }
}

/**
 * This function is used to fix the creation information (match, transformations list, transformations values, metadata match) of contract with misaligned creation data.
 *
 * We beging by mocking both the compilation and the sourcifyChain information with data from the database, so that recompilation and rpc calls are not performed.
 * Then we verify the contract again with the new mocked compilation and sourcifyChain objects.
 * Finally we upgrade the misaligned contract by UPDATING the verified_contracts and sourcify_matches creation fields.
 */
export async function upgradeContract(
  req: LegacyVerifyRequest,
  res: Response,
): Promise<any> {
  const sourcifyMatchId = req.body.sourcifyMatchId;
  if (!sourcifyMatchId) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .send({ error: "sourcifyMatchId is required" });
  }

  const solc = req.app.get("solc") as ISolidityCompiler;
  const services = req.app.get("services") as Services;

  // Get the connection pool from storage service to fetch data
  const sourcifyDatabaseService =
    services.storage.rwServices["SourcifyDatabase"];

  if (!sourcifyDatabaseService) {
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send({ error: "Database service not available" });
  }

  // Access the pool via the sourcifyDatabaseService
  const poolClient = await (
    sourcifyDatabaseService as any
  ).database.pool.connect();

  try {
    const deploymentResult = await poolClient.query(
      `SELECT 
        verified_contracts.id as verified_contract_id,
        contract_deployments.address,
        contract_deployments.transaction_hash,
        contract_deployments.chain_id,
        contract_deployments.block_number,
        contract_deployments.transaction_index,
        encode(contract_deployments.deployer, 'hex') as deployer,
        onchain_creation_code.code as onchain_creation_code,
        onchain_runtime_code.code as onchain_runtime_code
      FROM contract_deployments
      JOIN verified_contracts ON verified_contracts.deployment_id = contract_deployments.id
      JOIN sourcify_matches ON sourcify_matches.verified_contract_id = verified_contracts.id
      JOIN contracts ON contracts.id = contract_deployments.contract_id
      JOIN code onchain_creation_code ON onchain_creation_code.code_hash = contracts.creation_code_hash
      JOIN code onchain_runtime_code ON onchain_runtime_code.code_hash = contracts.runtime_code_hash
      WHERE sourcify_matches.id = $1`,
      [sourcifyMatchId],
    );

    const address = `0x${deploymentResult.rows[0].address.toString("hex")}`;
    const transactionHash = `0x${deploymentResult.rows[0].transaction_hash.toString("hex")}`;
    const chainId = deploymentResult.rows[0].chain_id;

    const databaseCompilation = new DatabaseCompilation(
      solc,
      poolClient,
      address,
      chainId,
      transactionHash,
    );

    const contractDeployment = deploymentResult.rows[0];

    const sourcifyChainMock = {
      getBytecode: async (address: string) => {
        return `0x${contractDeployment.onchain_runtime_code.toString("hex")}`;
      },
      getTx: async (txHash: string) => {
        return {
          blockNumber: contractDeployment.block_number,
          from: `0x${contractDeployment.deployer.toString("hex")}`,
        };
      },
      getContractCreationBytecodeAndReceipt: async (address: string) => {
        return {
          creationBytecode: `0x${contractDeployment.onchain_creation_code.toString("hex")}`,
          txReceipt: {
            index: contractDeployment.transaction_index,
          },
        };
      },
      chainId: chainId,
    };

    const verification = new Verification(
      await databaseCompilation.createCompilation(),
      sourcifyChainMock as any,
      address,
      transactionHash,
    );

    await verification.verify();

    // Get the verification status
    const verificationStatus = verification.status;
    const creationMatch =
      verificationStatus.creationMatch === "perfect" ||
      verificationStatus.creationMatch === "partial";

    let creationTransformations = null;
    let creationValues = null;
    let creationMetadataMatch = null;
    if (creationMatch) {
      creationTransformations = verification.transformations.creation.list
        ? JSON.stringify(verification.transformations.creation.list)
        : [];
      creationValues = verification.transformations.creation.values
        ? JSON.stringify(verification.transformations.creation.values)
        : {};
      creationMetadataMatch = verification.status.creationMatch === "perfect";
    }

    // Begin transaction for database updates
    await poolClient.query("BEGIN");

    // 1. Update verified_contracts table using direct query
    await poolClient.query(
      `UPDATE verified_contracts SET 
        creation_match = $1,
        creation_transformations = $2,
        creation_values = $3,
        creation_metadata_match = $4
      WHERE id = $5`,
      [
        creationMatch,
        creationTransformations,
        creationValues,
        creationMetadataMatch,
        contractDeployment.verified_contract_id,
      ],
    );

    // 2. Update sourcify_matches table using direct query instead of updateSourcifyMatch
    await poolClient.query(
      `UPDATE sourcify_matches SET 
        creation_match = $1
      WHERE id = $2`,
      [verificationStatus.creationMatch, sourcifyMatchId],
    );

    // Commit the transaction
    await poolClient.query("COMMIT");

    res.send({
      result: {
        message: "Contract upgrade successful",
        verifiedContractId: contractDeployment.verified_contract_id,
        sourcifyMatchId: sourcifyMatchId,
      },
    });
  } catch (error: any) {
    // Rollback in case of error
    if (poolClient) {
      await poolClient.query("ROLLBACK");
    }
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send({ error: error.message });
  } finally {
    // Release the client back to the pool
    if (poolClient) {
      poolClient.release();
    }
  }
}
