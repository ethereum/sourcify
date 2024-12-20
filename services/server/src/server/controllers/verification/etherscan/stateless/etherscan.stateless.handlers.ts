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
  VyperCheckedContract,
} from "@ethereum-sourcify/lib-sourcify";
import { Services } from "../../../../services/services";
import { BadRequestError } from "../../../../../common/errors";

async function processEtherscanSolidityContract(
  solc: ISolidityCompiler,
  compilerVersion: string,
  solcJsonInput: any,
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
  vyperJsonInput: any,
  contractPath: string,
  contractName: string,
) {
  return new VyperCheckedContract(
    vyperCompiler,
    compilerVersion,
    contractPath,
    contractName,
    vyperJsonInput.settings,
    vyperJsonInput.sources,
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

  const {
    language,
    compilerVersion,
    solcJsonInput,
    vyperJsonInput,
    contractName,
    contractPath,
  } = await processRequestFromEtherscan(sourcifyChain, address, apiKey);

  let checkedContract;
  if (language === "Solidity") {
    checkedContract = await processEtherscanSolidityContract(
      solc,
      compilerVersion,
      solcJsonInput,
      contractName,
    );
  } else if (language === "Vyper") {
    checkedContract = await processEtherscanVyperContract(
      vyperCompiler,
      compilerVersion,
      vyperJsonInput,
      contractPath,
      contractName,
    );
  } else {
    logger.error("Import from Etherscan: unsupported language", {
      language,
    });
    throw new BadRequestError("Unsupported language: " + language);
  }

  const match = await services.verification.verifyDeployed(
    checkedContract,
    sourcifyChain,
    address,
  );

  await services.storage.storeMatch(checkedContract, match);

  res.send({ result: [getResponseMatchFromMatch(match)] });
}
