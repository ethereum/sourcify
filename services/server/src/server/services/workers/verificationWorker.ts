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
import { VerifyFromJsonInputs, VerifyFromJsonOutput } from "./workerTypes";

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
}: VerifyFromJsonInputs): Promise<VerifyFromJsonOutput> {
  initWorker();

  const sourcifyChain = chainRepository.sourcifyChainMap[chainId];

  const foundCreationTxHash =
    creationTransactionHash ||
    (await getCreatorTx(sourcifyChain, address)) ||
    undefined;

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
