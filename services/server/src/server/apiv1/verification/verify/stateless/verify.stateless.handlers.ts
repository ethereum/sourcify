import { Response } from "express";
import { LegacyVerifyRequest, extractFiles } from "../../verification.common";
import {
  ISolidityCompiler,
  SolidityMetadataContract,
  createMetadataContractsFromFiles,
  VerificationError,
  Verification,
  useAllSourcesAndReturnCompilation,
} from "@ethereum-sourcify/lib-sourcify";
import { BadRequestError, NotFoundError } from "../../../../../common/errors";
import { StatusCodes } from "http-status-codes";
import { getResponseMatchFromVerification } from "../../../../common";
import { Services } from "../../../../services/services";
import { ChainRepository } from "../../../../../sourcify-chain-repository";
import logger from "../../../../../common/logger";

export async function legacyVerifyEndpoint(
  req: LegacyVerifyRequest,
  res: Response,
): Promise<any> {
  const services = req.app.get("services") as Services;
  const solc = req.app.get("solc") as ISolidityCompiler;
  const chainRepository = req.app.get("chainRepository") as ChainRepository;

  const inputFiles = extractFiles(req);
  if (!inputFiles) {
    const msg =
      "Couldn't extract files from the request. Please make sure you have added files";
    throw new NotFoundError(msg);
  }

  let metadataContracts: SolidityMetadataContract[];
  try {
    metadataContracts = (await createMetadataContractsFromFiles(
      inputFiles,
    )) as SolidityMetadataContract[];
  } catch (error: any) {
    throw new BadRequestError(error.message);
  }

  if (metadataContracts.length !== 1 && !req.body.chosenContract) {
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

  const contract: SolidityMetadataContract = req.body.chosenContract
    ? metadataContracts[req.body.chosenContract]
    : metadataContracts[0];

  if (!contract) {
    throw new NotFoundError(
      "Chosen contract not found. Received chosenContract: " +
        req.body.chosenContract,
    );
  }

  // Fetch missing files
  try {
    await contract.fetchMissing();
  } catch (error: any) {
    logger.silly("Error fetching missing files", {
      error: error,
    });
  }

  if (!contract.isCompilable()) {
    throw new BadRequestError(
      "Invalid or missing sources in:\n" + contract.name,
    );
  }

  const compilation = await contract.createCompilation(solc);

  let verification: Verification;
  try {
    verification = await services.verification.verifyFromCompilation(
      compilation,
      chainRepository.sourcifyChainMap[req.body.chain],
      req.body.address,
      req.body.creatorTxHash,
    );
  } catch (error) {
    // If the error is not a VerificationError, log and rethrow
    if (!(error instanceof VerificationError)) {
      logger.error("Verification error", { error });
      throw error;
    }
    // For VerificationError instances, handle non-extra_file_input_bug errors first.
    if (error.code !== "extra_file_input_bug") {
      logger.warn("Verification error", { error });
      throw error;
    }
    // Handle the extra_file_input_bug by logging, reconstructing the compilation with all sources,
    // and then reattempting the verification.
    logger.info("Found extra-file-input-bug", {
      contract: contract.name,
      chain: req.body.chain,
      address: req.body.address,
    });
    const contractWithAllSources = await useAllSourcesAndReturnCompilation(
      compilation,
      inputFiles,
    );
    try {
      verification = await services.verification.verifyFromCompilation(
        contractWithAllSources,
        chainRepository.sourcifyChainMap[req.body.chain],
        req.body.address,
        req.body.creatorTxHash,
      );
    } catch (fallbackError: any) {
      // This catch ensures compatibility with the old verification flow
      logger.warn("Verification error", { error: fallbackError });
      throw new BadRequestError(fallbackError.message);
    }
  }

  await services.storage.storeVerification(verification);
  return res.send({ result: [getResponseMatchFromVerification(verification)] }); // array is an old expected behavior (e.g. by frontend)
}

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
    metadataContracts = (await createMetadataContractsFromFiles(
      inputFiles,
    )) as SolidityMetadataContract[];
  } catch (error: any) {
    throw new BadRequestError(error.message);
  }

  const errors = metadataContracts
    .filter((contract) => !contract.isCompilable())
    .map((contract) => contract.name);
  if (errors.length) {
    throw new BadRequestError(
      "Invalid or missing sources in:\n" + errors.join("\n"),
    );
  }

  if (metadataContracts.length !== 1 && !req.body.chosenContract) {
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

  const contract: SolidityMetadataContract = req.body.chosenContract
    ? metadataContracts[req.body.chosenContract]
    : metadataContracts[0];

  if (!contract) {
    throw new NotFoundError(
      "Chosen contract not found. Received chosenContract: " +
        req.body.chosenContract,
    );
  }

  // Fetch missing files
  try {
    await contract.fetchMissing();
  } catch (error: any) {
    logger.silly("Error fetching missing files", {
      error: error,
    });
  }

  if (!contract.isCompilable()) {
    throw new BadRequestError(
      "Invalid or missing sources in:\n" + contract.name,
    );
  }

  try {
    // Create a compilation from the contract and compile it
    const compilation = await contract.createCompilation(solc);
    await compilation.compile();
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
    await services.storage.storeVerification(verification);

    return res.send({
      result: [getResponseMatchFromVerification(verification)],
    });
  } catch (error: any) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send({ error: error.message });
  }
}
