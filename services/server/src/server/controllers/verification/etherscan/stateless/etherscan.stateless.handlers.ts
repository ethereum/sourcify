import { Response, Request } from "express";
import {
  getMappedSourcesFromJsonInput,
  getMetadataFromCompiler,
  processRequestFromEtherscan,
} from "../etherscan.common";
import { getResponseMatchFromMatch } from "../../../../common";
import { createCheckedContract } from "../../verification.common";
import logger from "../../../../../common/logger";
import { ChainRepository } from "../../../../../sourcify-chain-repository";
import { ISolidityCompiler } from "@ethereum-sourcify/lib-sourcify";
import { Services } from "../../../../services/services";

export async function verifyFromEtherscan(req: Request, res: Response) {
  const services = req.app.get("services") as Services;
  const chainRepository = req.app.get("chainRepository") as ChainRepository;
  chainRepository.checkSupportedChainId(req.body.chain);

  const solc = req.app.get("solc") as ISolidityCompiler;

  const chain = req.body.chain as string;
  const address = req.body.address;
  const apiKey = req.body.apiKey;
  const sourcifyChain = chainRepository.supportedChainMap[chain];

  logger.info("verifyFromEtherscan", { chain, address, apiKey });

  const { compilerVersion, solcJsonInput, contractName } =
    await processRequestFromEtherscan(sourcifyChain, address, apiKey);

  const metadata = await getMetadataFromCompiler(
    solc,
    compilerVersion,
    solcJsonInput,
    contractName,
  );

  const mappedSources = getMappedSourcesFromJsonInput(solcJsonInput);
  const checkedContract = createCheckedContract(solc, metadata, mappedSources);

  const match = await services.verification.verifyDeployed(
    checkedContract,
    sourcifyChain,
    address,
  );

  await services.storage.storeMatch(checkedContract, match);

  res.send({ result: [getResponseMatchFromMatch(match)] });
}
