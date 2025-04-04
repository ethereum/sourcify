import Piscina from "piscina";
import {
  SolidityJsonInput,
  VyperJsonInput,
  SolidityCompilation,
  VyperCompilation,
  Verification,
  SourcifyLibError,
  SourcifyChain,
  SourcifyChainInstance,
  SourcifyChainMap,
  SolidityMetadataContract,
  useAllSourcesAndReturnCompilation,
} from "@ethereum-sourcify/lib-sourcify";
import { resolve } from "path";
import { ChainRepository } from "../../../sourcify-chain-repository";
import { SolcLocal } from "../compiler/local/SolcLocal";
import { VyperLocal } from "../compiler/local/VyperLocal";
import {
  getVerificationErrorMessage,
  MatchingErrorResponse,
} from "../../apiv2/errors";
import { v4 as uuidv4 } from "uuid";
import { getCreatorTx } from "../utils/contract-creation-util";
import type {
  VerifyFromJsonInput,
  VerifyFromMetadataInput,
  VerifyOutput,
} from "./workerTypes";
import logger from "../../../common/logger";

export const filename = resolve(__filename);

let chainRepository: ChainRepository;
let solc: SolcLocal;
let vyper: VyperLocal;

const initWorker = () => {
  if (chainRepository && solc && vyper) {
    return;
  }

  const sourcifyChainInstanceMap = Piscina.workerData
    .sourcifyChainInstanceMap as { [chainId: string]: SourcifyChainInstance };

  const sourcifyChainMap = Object.entries(sourcifyChainInstanceMap).reduce(
    (acc, [chainId, chain]) => {
      acc[chainId] = new SourcifyChain(chain);
      return acc;
    },
    {} as SourcifyChainMap,
  );

  chainRepository = new ChainRepository(sourcifyChainMap);
  solc = new SolcLocal(
    Piscina.workerData.solcRepoPath,
    Piscina.workerData.solJsonRepoPath,
  );
  vyper = new VyperLocal(Piscina.workerData.vyperRepoPath);
};

export async function verifyFromJsonInput({
  chainId,
  address,
  jsonInput,
  compilerVersion,
  compilationTarget,
  creationTransactionHash,
}: VerifyFromJsonInput): Promise<VerifyOutput> {
  initWorker();

  let compilation: SolidityCompilation | VyperCompilation | undefined;
  try {
    if (jsonInput.language === "Solidity") {
      compilation = new SolidityCompilation(
        solc,
        compilerVersion,
        jsonInput as SolidityJsonInput,
        compilationTarget,
      );
    } else if (jsonInput.language === "Vyper") {
      compilation = new VyperCompilation(
        vyper,
        compilerVersion,
        jsonInput as VyperJsonInput,
        compilationTarget,
      );
    }
  } catch (error: any) {
    return {
      errorResponse: createMatchingError(error),
    };
  }

  if (!compilation) {
    return {
      errorResponse: {
        customCode: "unsupported_language",
        message: getVerificationErrorMessage("unsupported_language"),
        errorId: uuidv4(),
      },
    };
  }

  const sourcifyChain = chainRepository.sourcifyChainMap[chainId];
  const foundCreationTxHash =
    creationTransactionHash ||
    (await getCreatorTx(sourcifyChain, address)) ||
    undefined;

  const verification = new Verification(
    compilation,
    sourcifyChain,
    address,
    foundCreationTxHash,
  );

  try {
    await verification.verify();
  } catch (error: any) {
    return {
      errorResponse: createMatchingError(error, verification),
    };
  }

  return {
    verificationExport: verification.export(),
  };
}

export async function verifyFromMetadata({
  chainId,
  address,
  metadata,
  sources,
  creationTransactionHash,
}: VerifyFromMetadataInput): Promise<VerifyOutput> {
  initWorker();

  const sourcesList = Object.entries(sources).map(([path, content]) => ({
    path,
    content,
  }));
  const metadataContract = new SolidityMetadataContract(metadata, sourcesList);

  let compilation: SolidityCompilation;
  try {
    // Includes fetching missing sources
    compilation = await metadataContract.createCompilation(solc);
  } catch (error: any) {
    return {
      errorResponse: createMatchingError(error),
    };
  }

  const sourcifyChain = chainRepository.sourcifyChainMap[chainId];
  const foundCreationTxHash =
    creationTransactionHash ||
    (await getCreatorTx(sourcifyChain, address)) ||
    undefined;

  let verification = new Verification(
    compilation,
    sourcifyChain,
    address,
    foundCreationTxHash,
  );

  try {
    await verification.verify();
  } catch (error: any) {
    if (error.code !== "extra_file_input_bug") {
      return {
        errorResponse: createMatchingError(error, verification),
      };
    }

    logger.info("Found extra-file-input-bug", {
      contract: metadataContract.name,
      chainId,
      address,
    });

    const sourcesBuffer = sourcesList.map(({ path, content }) => ({
      path,
      buffer: Buffer.from(content),
    }));
    const compilationWithAllSources = await useAllSourcesAndReturnCompilation(
      compilation,
      sourcesBuffer,
    );
    verification = new Verification(
      compilationWithAllSources,
      sourcifyChain,
      address,
      foundCreationTxHash,
    );

    try {
      await verification.verify();
    } catch (allSourcesError: any) {
      return {
        errorResponse: createMatchingError(allSourcesError, verification),
      };
    }
  }

  return {
    verificationExport: verification.export(),
  };
}

function createMatchingError(
  error: Error,
  verification?: Verification,
): MatchingErrorResponse {
  if (!(error instanceof SourcifyLibError)) {
    // If the error is not a SourcifyLibError, the server reached an unexpected state.
    // Let the VerificationService log and handle it.
    throw error;
  }

  // Use VerificationExport to get bytecodes as it does not throw when accessing properties
  const verificationExport = verification?.export();
  return {
    customCode: error.code,
    message: error.message,
    errorId: uuidv4(),
    onchainRuntimeCode: verificationExport?.onchainRuntimeBytecode,
    onchainCreationCode: verificationExport?.onchainCreationBytecode,
    recompiledRuntimeCode: verificationExport?.compilation.runtimeBytecode,
    recompiledCreationCode: verificationExport?.compilation.creationBytecode,
    creationTransactionHash: verificationExport?.deploymentInfo.txHash,
  };
}
