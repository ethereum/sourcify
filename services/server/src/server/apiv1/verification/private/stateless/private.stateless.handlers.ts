import { Response } from "express";
import { LegacyVerifyRequest, extractFiles } from "../../verification.common";
import {
  ISolidityCompiler,
  SolidityMetadataContract,
  createMetadataContractsFromFiles,
  Verification,
  SolidityJsonInput,
  SolidityCompilation,
  AbstractCompilation,
  CompilationTarget,
  SourcifyChain,
  VyperJsonInput,
  IVyperCompiler,
  VyperCompilation,
} from "@ethereum-sourcify/lib-sourcify";
import { BadRequestError, NotFoundError } from "../../../../../common/errors";
import { StatusCodes } from "http-status-codes";
import { Services } from "../../../../services/services";
import { ChainRepository } from "../../../../../sourcify-chain-repository";
import logger from "../../../../../common/logger";
import { getApiV1ResponseFromVerification } from "../../../controllers.common";
import { DatabaseCompilation } from "../../../../services/utils/DatabaseCompilation";
import { SourcifyDatabaseService } from "../../../../services/storageServices/SourcifyDatabaseService";
import SourcifyChainMock from "../../../../services/utils/SourcifyChainMock";
import { withTransaction } from "../../../../services/utils/database-util";

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
 * Endpoint: /private/replace-contract
 *
 * This endpoint allows the Sourcify instance maintainer to replace an existing contract in the database,
 * addressing issues with misaligned or incorrect contract data. Historically, fixing such issues required
 * custom scripts for each case (#1974), but this endpoint provides a generic, maintainable solution.
 * This new endpoint optimizes performance by optionally skipping recompilation and on-chain RPC calls,
 * using data already stored in the database. This endpoint is private and should only be callable by the
 * Sourcify instance maintainer.
 *
 * @param {string|number} req.body.chainId - The chain ID of the contract.
 * @param {string} req.body.address - The contract address.
 * @param {string} req.body.transactionHash - The creation transaction hash.
 * @param {boolean} req.body.forceCompilation - If true, recompiles the contract using the provided jsonInput, compilerVersion and compilationTarget.
 * @param {boolean} req.body.forceRPCRequest - If true, fetches the contract's information from the RPC.
 * @param {object} [req.body.jsonInput] - If forceCompilation is true, provide jsonInput to use for recompilation.
 * @param {string} [req.body.compilerVersion] - If forceCompilation is true, provide the compiler version to use for recompilation.
 * @param {object} [req.body.compilationTarget] - If forceCompilation is true, provide the compilation target to use for recompilation.
 */
export async function replaceContract(
  req: LegacyVerifyRequest,
  res: Response,
): Promise<any> {
  // Extract the request body parameters
  const address = req.body.address;
  const transactionHash = req.body.transactionHash;
  const chainId = req.body.chainId;

  const forceCompilation = req.body.forceCompilation;
  let jsonInput: SolidityJsonInput | VyperJsonInput | undefined;
  let compilerVersion: string | undefined;
  let compilationTarget: CompilationTarget | undefined;
  if (forceCompilation) {
    jsonInput = req.body.jsonInput;
    compilerVersion = req.body.compilerVersion;
    compilationTarget = req.body.compilationTarget;
  }

  const forceRPCRequest = req.body.forceRPCRequest;

  // Get the solc compiler and services
  const solc = req.app.get("solc") as ISolidityCompiler;
  const vyper = req.app.get("vyper") as IVyperCompiler;
  const services = req.app.get("services") as Services;

  // Get the connection pool from SourcifyDatabaseService
  const sourcifyDatabaseService = services.storage.rwServices[
    "SourcifyDatabase"
  ] as SourcifyDatabaseService;
  if (!sourcifyDatabaseService) {
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send({ error: "Database service not available" });
  }

  try {
    let compilation: AbstractCompilation;
    if (!forceCompilation) {
      // Create a DatabaseCompilation object to create a PreRunCompilation object
      const databaseCompilation = new DatabaseCompilation(
        jsonInput?.language === "Solidity" ? solc : vyper,
        sourcifyDatabaseService.database,
        address,
        chainId,
        transactionHash,
      );
      compilation = await databaseCompilation.createCompilation();
    } else {
      // Create a SolidityCompilation object and compile it if forceCompilation is true
      if (
        jsonInput === undefined ||
        compilerVersion === undefined ||
        compilationTarget === undefined
      ) {
        throw new BadRequestError(
          "jsonInput, compilerVersion and compilationTarget are required when forceCompilation is true",
        );
      }
      if (jsonInput?.language === "Solidity") {
        compilation = new SolidityCompilation(
          solc,
          compilerVersion,
          jsonInput as SolidityJsonInput,
          compilationTarget,
        );
      } else if (jsonInput?.language === "Vyper") {
        compilation = new VyperCompilation(
          vyper,
          compilerVersion,
          jsonInput as VyperJsonInput,
          compilationTarget,
        );
      } else {
        throw new BadRequestError(
          "Invalid language. Only Solidity and Vyper are supported",
        );
      }
      await compilation.compile();
    }

    let sourcifyChain: SourcifyChain;
    if (!forceRPCRequest) {
      // Create a SourcifyChainMock object filled with data from the database
      sourcifyChain = new SourcifyChainMock(
        sourcifyDatabaseService.database,
        chainId,
        address,
        transactionHash,
      );
      await (sourcifyChain as SourcifyChainMock).init();
    } else {
      // Use the chainRepository to get the sourcifyChain object and fetch the contract's information from the RPC
      const chainRepository = req.app.get("chainRepository") as ChainRepository;
      sourcifyChain = chainRepository.sourcifyChainMap[chainId];
    }

    const verification = new Verification(
      compilation,
      sourcifyChain,
      address,
      transactionHash,
    );

    await verification.verify();

    // Get the verification status
    const verificationStatus = verification.status;
    const creationMatch =
      verificationStatus.creationMatch === "perfect" ||
      verificationStatus.creationMatch === "partial";

    const runtimeMatch =
      verificationStatus.runtimeMatch === "perfect" ||
      verificationStatus.runtimeMatch === "partial";

    // If the new verification leads to a non-match, we can't replace the contract
    if (!runtimeMatch || !creationMatch) {
      throw new BadRequestError(
        "The contract is not verified or the verification is not perfect",
      );
    }

    await withTransaction(
      sourcifyDatabaseService.database,
      async (transactionPoolClient) => {
        // Delete the old verification information from the database
        await sourcifyDatabaseService.database.deleteMatch(
          transactionPoolClient,
          chainId,
          address,
          transactionHash,
        );

        // Insert the new verification information into the database
        await sourcifyDatabaseService.storeVerification(
          verification.export(),
          undefined, // jobData
          transactionPoolClient,
        );
      },
      (error) => {
        logger.error("Error replacing contract", {
          error: error,
          verification: verification.export(),
        });
      },
    );

    res.send({
      replaced: true,
      address: address,
      chainId: chainId,
      transactionHash: transactionHash,
      newStatus: verificationStatus,
    });
  } catch (error: any) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send({ error: error.message });
  }
}
