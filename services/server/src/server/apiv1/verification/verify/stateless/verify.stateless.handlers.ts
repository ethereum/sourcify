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
  } catch (e) {
    if (e instanceof VerificationError) {
      if (e.code === "extra_file_input_bug") {
        logger.info("Found extra-file-input-bug", {
          contract: contract.name,
          chain: req.body.chain,
          address: req.body.address,
        });
        const contractWithAllSources = await useAllSourcesAndReturnCompilation(
          compilation,
          inputFiles,
        );
        verification = await services.verification
          .verifyFromCompilation(
            contractWithAllSources,
            chainRepository.sourcifyChainMap[req.body.chain],
            req.body.address,
            req.body.creatorTxHash,
          )
          .catch((e) => {
            // This catch is needed to being compatible with the old verification flow
            logger.warn("Verification error", {
              error: e,
            });
            throw new BadRequestError(e.message);
          });
      } else {
        logger.warn("Verification error", {
          error: e,
        });
        throw e;
      }
    } else {
      logger.error("Verification error", {
        error: e,
      });
      throw e;
    }
  }

  await services.storage.storeVerification(verification);
  return res.send({ result: [getResponseMatchFromVerification(verification)] }); // array is an old expected behavior (e.g. by frontend)
}

// TODO: handle this
/* 
export async function verifyDeprecated(
  req: LegacyVerifyRequest,
  res: Response,
): Promise<any> {
  const solc = req.app.get("solc") as ISolidityCompiler;
  const vyper = req.app.get("vyper") as IVyperCompiler;
  const services = req.app.get("services") as Services;

  const inputFiles = extractFiles(req);
  if (!inputFiles) {
    const msg =
      "Couldn't extract files from the request. Please make sure you have added files";
    throw new NotFoundError(msg);
  }

  let checkedContracts: SolidityCheckedContract[];
  try {
    checkedContracts = (await checkFilesWithMetadata(
      solc,
      vyper,
      inputFiles,
    )) as SolidityCheckedContract[];
  } catch (error: any) {
    throw new BadRequestError(error.message);
  }

  const errors = checkedContracts
    .filter((contract) => !contract.isValid(true))
    .map(stringifyInvalidAndMissing);
  if (errors.length) {
    throw new BadRequestError(
      "Invalid or missing sources in:\n" + errors.join("\n"),
    );
  }

  if (checkedContracts.length !== 1 && !req.body.chosenContract) {
    const contractNames = checkedContracts.map((c) => c.name).join(", ");
    const msg = `Detected ${checkedContracts.length} contracts (${contractNames}), but can only verify 1 at a time. Please choose a main contract and click Verify again.`;
    const contractsToChoose = checkedContracts.map((contract) => ({
      name: contract.name,
      path: contract.compiledPath,
    }));
    return res
      .status(StatusCodes.BAD_REQUEST)
      .send({ error: msg, contractsToChoose });
  }

  const contract: SolidityCheckedContract = req.body.chosenContract
    ? checkedContracts[req.body.chosenContract]
    : checkedContracts[0];

  if (!contract) {
    throw new NotFoundError(
      "Chosen contract not found. Received chosenContract: " +
        req.body.chosenContract,
    );
  }

  const match: Match = {
    address: req.body.address,
    chainId: req.body.chain,
    runtimeMatch: null,
    creationMatch: null,
    runtimeTransformations: [],
    creationTransformations: [],
    runtimeTransformationValues: {},
    creationTransformationValues: {},
  };

  const generateRuntimeCborAuxdataPositions = async () => {
    if (!contract.runtimeBytecodeCborAuxdata) {
      await contract.generateCborAuxdataPositions();
    }
    return contract.runtimeBytecodeCborAuxdata || {};
  };

  try {
    const {
      runtimeBytecode: recompiledRuntimeBytecode,
      immutableReferences,
      runtimeLinkReferences,
      // creationLinkReferences,
    } = await contract.recompile();

    // we are running also matchWithRuntimeBytecode to extract transformations
    await matchWithRuntimeBytecode(
      match,
      recompiledRuntimeBytecode,
      recompiledRuntimeBytecode, // onchainBytecode
      generateRuntimeCborAuxdataPositions,
      immutableReferences,
      runtimeLinkReferences,
      AuxdataStyle.SOLIDITY,
    );

    match;
    const matchStatus = getMatchStatus(match);
    if (matchStatus !== "perfect") {
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .send({ error: "Match is neither partial or perfect" });
    }

    // Override match properties
    match.runtimeMatch = req.body.match;
    match.creationMatch = req.body.match;
    // hex for !!!!!!!!!!! - chain was deprecated at the time of verification";
    match.onchainRuntimeBytecode =
      "0x2121212121212121212121202d20636861696e207761732064657072656361746564206174207468652074696d65206f6620766572696669636174696f6e";
    match.onchainCreationBytecode =
      "0x2121212121212121212121202d20636861696e207761732064657072656361746564206174207468652074696d65206f6620766572696669636174696f6e";
    match.blockNumber = -1;
    match.creatorTxHash = undefined; // null bytea
    match.txIndex = -1;
    match.deployer = undefined; // null bytea

    await services.storage.storeMatch(contract, match);
    return res.send({ result: [getResponseMatchFromMatch(match)] });
  } catch (error: any) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send({ error: error.message });
  }
} */
