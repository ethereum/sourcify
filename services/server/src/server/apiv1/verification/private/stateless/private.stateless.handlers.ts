import { Response } from "express";
import { LegacyVerifyRequest, extractFiles } from "../../verification.common";
import {
  ISolidityCompiler,
  SolidityMetadataContract,
  createMetadataContractsFromFiles,
  Verification,
  SolidityCompilation,
  SolidityJsonInput,
  SourcifyChain,
} from "@ethereum-sourcify/lib-sourcify";
import { BadRequestError, NotFoundError } from "../../../../../common/errors";
import { StatusCodes } from "http-status-codes";
import { Services } from "../../../../services/services";
import { ChainRepository } from "../../../../../sourcify-chain-repository";
import logger from "../../../../../common/logger";
import { getApiV1ResponseFromVerification } from "../../../controllers.common";

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

export async function upgradeContract(
  req: LegacyVerifyRequest,
  res: Response,
): Promise<any> {
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
    // Fetch compilation data from the database
    const verifiedContractResult = await poolClient.query(
      `SELECT 
        verified_contracts.*,
        compiled_contracts.compiler,
        compiled_contracts.version,
        compiled_contracts.language,
        compiled_contracts.name,
        compiled_contracts.fully_qualified_name,
        compiled_contracts.compiler_settings
      FROM public.verified_contracts
      JOIN public.compiled_contracts ON compiled_contracts.id = verified_contracts.compilation_id
      WHERE verified_contracts.id = $1`,
      [req.body.verifiedContractId],
    );

    if (verifiedContractResult.rows.length === 0) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .send({ error: "Verified contract not found" });
    }

    const verifiedContract = verifiedContractResult.rows[0];

    // Fetch sources
    const sourcesResult = await poolClient.query(
      `SELECT 
        sources.content,
        compiled_contracts_sources.path
      FROM public.compiled_contracts_sources
      JOIN public.sources ON sources.source_hash = compiled_contracts_sources.source_hash
      WHERE compiled_contracts_sources.compilation_id = $1`,
      [verifiedContract.compilation_id],
    );

    // Initialize jsonInput with data from database
    const compilerVersion = verifiedContract.version || "0.8.25";

    // Create sources object from the query result
    const sources: Record<string, { content: string }> = {};
    for (const source of sourcesResult.rows) {
      sources[source.path] = { content: source.content };
    }

    // Create settings from compiler_settings JSON field
    const settings = verifiedContract.compiler_settings || {
      optimizer: { enabled: false, runs: 200 },
      outputSelection: {
        "*": {
          "*": [
            "abi",
            "evm.bytecode",
            "evm.deployedBytecode",
            "evm.methodIdentifiers",
            "metadata",
          ],
        },
      },
    };

    // Initialize jsonInput with the required fields
    const jsonInput: SolidityJsonInput = {
      language: "Solidity",
      sources: sources,
      settings: settings,
    };

    // Get the file path and contract name from fully_qualified_name
    const pathParts = verifiedContract.fully_qualified_name.split(":");
    const compilationTarget = {
      name: pathParts.length > 1 ? pathParts[1] : verifiedContract.name,
      path:
        pathParts.length > 1
          ? pathParts[0]
          : `contracts/${verifiedContract.name}.sol`,
    };

    const compilation = new SolidityCompilation(
      solc,
      compilerVersion,
      jsonInput,
      compilationTarget,
    );

    compilation.compilerOutput = {
      contracts: {
        [compilationTarget.path]: {
          [compilationTarget.name]: {
            abi: [],
            metadata: "{}",
            evm: {
              bytecode: {
                object: "0x",
              },
              deployedBytecode: {
                object: "0x",
              },
            },
          },
        },
      },
    };

    const sourcifyChainMock = {
      getBytecode: async (address: string) => {
        return "0x";
      },
      getTx: async (txHash: string) => {
        return {
          blockNumber: 1,
          from: "0x",
        };
      },
      getContractCreationBytecodeAndReceipt: async (address: string) => {
        return {
          creationBytecode: "0x",
          txReceipt: {
            index: 0,
          },
        };
      },
      chainId: 1,
    };

    const verification = new Verification(
      compilation,
      sourcifyChainMock as any,
      req.body.address,
      req.body.creatorTxHash,
    );

    verification.verify();

    // Begin transaction for database updates
    await poolClient.query("BEGIN");

    // Get the verification status
    const verificationStatus = verification.status;

    // 1. Update verified_contracts table using direct query
    await poolClient.query(
      `UPDATE public.verified_contracts SET 
        creation_match = $1,
        creation_transformations = $2,
        creation_values = $3
      WHERE id = $4`,
      [
        verificationStatus.creationMatch === "perfect" ||
          verificationStatus.creationMatch === "partial", // Store as boolean for database
        JSON.stringify(verification.transformations.creation.list || []), // Store transformations as JSON string
        verification.transformations.creation.values || null, // Store transformation values
        req.body.verifiedContractId, // ID of the contract to update
      ],
    );

    // 2. Update sourcify_matches table using direct query instead of updateSourcifyMatch
    await poolClient.query(
      `UPDATE public.sourcify_matches SET 
        creation_match = $1
      WHERE verified_contract_id = $2`,
      [
        verificationStatus.creationMatch, // Direct string value ('perfect', 'partial', etc.)
        req.body.verifiedContractId, // Original verified contract ID
      ],
    );

    // Commit the transaction
    await poolClient.query("COMMIT");

    res.send({
      result: {
        message: "Contract upgrade successful",
        verifiedContractId: req.body.verifiedContractId,
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
