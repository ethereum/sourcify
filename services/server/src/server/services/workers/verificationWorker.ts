import Piscina from "piscina";
import {
  SolidityJsonInput,
  VyperJsonInput,
  CompilationLanguage,
  VerificationExport,
  CompilationTarget,
  SolidityCompilation,
  VyperCompilation,
  Verification,
  SourcifyLibError,
} from "@ethereum-sourcify/lib-sourcify";
import { resolve } from "path";
import { ChainRepository } from "../../../sourcify-chain-repository";
import { SolcLocal } from "../compiler/local/SolcLocal";
import { VyperLocal } from "../compiler/local/VyperLocal";
import { getVerificationErrorMessage, MatchingError } from "../../apiv2/errors";
import { v4 as uuidv4 } from "uuid";
import { getCreatorTx } from "../utils/contract-creation-util";

export const filename = resolve(__filename);

let chainRepository: ChainRepository;
let solc: SolcLocal;
let vyper: VyperLocal;

const initWorker = () => {
  if (chainRepository && solc && vyper) {
    return;
  }
  chainRepository = new ChainRepository(Piscina.workerData.sourcifyChainsMap);
  solc = new SolcLocal(
    Piscina.workerData.solcRepoPath,
    Piscina.workerData.solJsonRepoPath,
  );
  vyper = new VyperLocal(Piscina.workerData.vyperRepoPath);
};

interface VerifyFromJsonInputs {
  chainId: string;
  address: string;
  language: CompilationLanguage;
  jsonInput: SolidityJsonInput | VyperJsonInput;
  compilerVersion: string;
  contractIdentifier: string;
  creationTransactionHash?: string;
}

export async function verifyFromJsonInput({
  chainId,
  address,
  language,
  jsonInput,
  compilerVersion,
  contractIdentifier,
  creationTransactionHash,
}: VerifyFromJsonInputs): Promise<VerificationExport> {
  initWorker();

  const [contractPath, contractName] = contractIdentifier.split(":");
  const compilationTarget: CompilationTarget = {
    name: contractName,
    path: contractPath,
  };

  const sourcifyChain = chainRepository.sourcifyChainMap[chainId];

  const foundCreationTxHash =
    creationTransactionHash ||
    (await getCreatorTx(sourcifyChain, address)) ||
    undefined;

  let compilation: SolidityCompilation | VyperCompilation | undefined;
  try {
    if (language === "Solidity") {
      compilation = new SolidityCompilation(
        solc,
        compilerVersion,
        jsonInput as SolidityJsonInput,
        compilationTarget,
      );
    } else if (language === "Vyper") {
      compilation = new VyperCompilation(
        vyper,
        compilerVersion,
        jsonInput as VyperJsonInput,
        compilationTarget,
      );
    }
  } catch (error: any) {
    throw createMatchingError(error);
  }

  if (!compilation) {
    throw new MatchingError({
      customCode: "unsupported_language",
      message: getVerificationErrorMessage("unsupported_language"),
      errorId: uuidv4(),
    });
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
    throw createMatchingError(error, verification);
  }

  return verification.export();
}

function createMatchingError(error: Error, verification?: Verification): Error {
  if (error instanceof SourcifyLibError) {
    // Use VerificationExport to get bytecodes as it does not throw when accessing properties
    const verificationExport = verification?.export();

    return new MatchingError({
      customCode: error.code,
      message: error.message,
      errorId: uuidv4(),
      onchainRuntimeCode: verificationExport?.onchainRuntimeBytecode,
      onchainCreationCode: verificationExport?.onchainCreationBytecode,
      recompiledRuntimeCode: verificationExport?.compilation.runtimeBytecode,
      recompiledCreationCode: verificationExport?.compilation.creationBytecode,
      creationTransactionHash: verificationExport?.deploymentInfo.txHash,
    });
  }

  return error;
}
