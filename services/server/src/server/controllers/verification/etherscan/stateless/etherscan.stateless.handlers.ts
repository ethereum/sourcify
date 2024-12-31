import { Response, Request } from "express";
import {
  getMappedSourcesFromJsonInput,
  getMetadataFromCompiler,
  processRequestFromEtherscan,
} from "../etherscan.common";
import { getResponseMatchFromMatch } from "../../../../common";
import { createSolidityCheckedContract } from "../../verification.common";
import logger from "../../../../../common/logger";
import { ChainRepository } from "../../../../../sourcify-chain-repository";
import {
  ISolidityCompiler,
  IVyperCompiler,
  JsonInput,
  VyperCheckedContract,
  VyperJsonInput,
} from "@ethereum-sourcify/lib-sourcify";
import { Services } from "../../../../services/services";
import { BadRequestError } from "../../../../../common/errors";

async function processEtherscanSolidityContract(
  solc: ISolidityCompiler,
  compilerVersion: string,
  solcJsonInput: JsonInput,
  contractName: string,
) {
  const metadata = await getMetadataFromCompiler(
    solc,
    compilerVersion,
    solcJsonInput,
    contractName,
  );

  const mappedSources = getMappedSourcesFromJsonInput(solcJsonInput);
  return createSolidityCheckedContract(solc, metadata, mappedSources);
}

async function processEtherscanVyperContract(
  vyperCompiler: IVyperCompiler,
  compilerVersion: string,
  vyperJsonInput: VyperJsonInput,
  contractPath: string,
  contractName: string,
) {
  if (!vyperJsonInput.settings) {
    throw new BadRequestError(
      "Couldn't get Vyper compiler settings from Etherscan",
    );
  }
  const sourceMap = Object.fromEntries(
    Object.entries(vyperJsonInput.sources).map(([path, content]) => [
      path,
      content.content,
    ]),
  );

  return new VyperCheckedContract(
    vyperCompiler,
    compilerVersion,
    contractPath,
    contractName,
    vyperJsonInput.settings,
    sourceMap,
  );
}

export async function verifyFromEtherscan(req: Request, res: Response) {
  const services = req.app.get("services") as Services;
  const chainRepository = req.app.get("chainRepository") as ChainRepository;
  chainRepository.checkSupportedChainId(req.body.chain);

  const solc = req.app.get("solc") as ISolidityCompiler;
  const vyperCompiler = req.app.get("vyper") as IVyperCompiler;

  const chain = req.body.chain as string;
  const address = req.body.address;
  const apiKey = req.body.apiKey;
  const sourcifyChain = chainRepository.supportedChainMap[chain];

  logger.info("verifyFromEtherscan", { chain, address, apiKey });

  const { vyperResult, solidityResult } = await processRequestFromEtherscan(
    sourcifyChain,
    address,
    apiKey,
  );

  let checkedContract;
  if (solidityResult) {
    checkedContract = await processEtherscanSolidityContract(
      solc,
      solidityResult.compilerVersion,
      solidityResult.solcJsonInput,
      solidityResult.contractName,
    );
  } else if (vyperResult) {
    checkedContract = await processEtherscanVyperContract(
      vyperCompiler,
      vyperResult.compilerVersion,
      vyperResult.vyperJsonInput,
      vyperResult.contractPath,
      vyperResult.contractName,
    );
  } else {
    logger.error("Import from Etherscan: unsupported language");
    throw new BadRequestError("Received unsupported language from Etherscan");
  }

  const match = await services.verification.verifyDeployed(
    checkedContract,
    sourcifyChain,
    address,
  );

  await services.storage.storeMatch(checkedContract, match);

  res.send({ result: [getResponseMatchFromMatch(match)] });
}
