import { Response, Request } from "express";
import {
  getMappedSourcesFromJsonInput,
  getMetadataFromCompiler,
  processRequestFromEtherscan,
} from "../etherscan.common";
import { checkSupportedChainId } from "../../../../../sourcify-chains";
import { getResponseMatchFromMatch } from "../../../../common";
import { createCheckedContract } from "../../verification.common";
import { sourcifyChainsMap } from "../../../../../sourcify-chains";
import logger from "../../../../../common/logger";

export async function verifyFromEtherscan(req: Request, res: Response) {
  checkSupportedChainId(req.body.chain);

  const chain = req.body.chain as string;
  const address = req.body.address;
  const apiKey = req.body.apiKey;
  const sourcifyChain = sourcifyChainsMap[chain];

  logger.info("verifyFromEtherscan", { chain, address, apiKey });

  const { compilerVersion, solcJsonInput, contractName } =
    await processRequestFromEtherscan(sourcifyChain, address, apiKey);

  const metadata = await getMetadataFromCompiler(
    compilerVersion,
    solcJsonInput,
    contractName
  );

  const mappedSources = getMappedSourcesFromJsonInput(solcJsonInput);
  const checkedContract = createCheckedContract(metadata, mappedSources);

  const match = await req.services.verification.verifyDeployed(
    checkedContract,
    chain,
    address
  );

  await req.services.storage.storeMatch(checkedContract, match);

  res.send({ result: [getResponseMatchFromMatch(match)] });
}
