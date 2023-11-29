import { Response, Request } from "express";
import { services } from "../../../../services/services";
import { CheckedContract } from "@ethereum-sourcify/lib-sourcify";
import {
  getMappedSourcesFromJsonInput,
  getMetadataFromCompiler,
  processRequestFromEtherscan,
} from "../etherscan.common";
import { checkSupportedChainId } from "../../../../../sourcify-chains";
import { getResponseMatchFromMatch } from "../../../../common";
import { createCheckedContract } from "../../verification.common";
import { sourcifyChainsMap } from "../../../../../sourcify-chains";

export async function verifyFromEtherscan(req: Request, res: Response) {
  checkSupportedChainId(req.body.chain);

  const chain = req.body.chain as string;
  const address = req.body.address;
  const sourcifyChain = sourcifyChainsMap[chain];

  const { compilerVersion, solcJsonInput, contractName } =
    await processRequestFromEtherscan(sourcifyChain, address);

  const metadata = await getMetadataFromCompiler(
    compilerVersion,
    solcJsonInput,
    contractName
  );

  const mappedSources = getMappedSourcesFromJsonInput(solcJsonInput);
  const checkedContract = createCheckedContract(metadata, mappedSources);

  const match = await services.verification.verifyDeployed(
    checkedContract,
    chain,
    address
  );

  await services.storage.storeMatch(checkedContract, match);

  res.send({ result: [getResponseMatchFromMatch(match)] });
}
