import { Response, Request } from "express";
import { services } from "../../../../services/services";
import { CheckedContract } from "@ethereum-sourcify/lib-sourcify";
import {
  getMappedSourcesFromJsonInput,
  getMetadataFromCompiler,
  processRequestFromEtherscan,
} from "../etherscan.common";
import { checkSupportedChainId } from "../../../../../sourcify-chains";

export async function verifyFromEtherscan(req: Request, res: Response) {
  checkSupportedChainId(req.body.chain);

  const chain = req.body.chain as string;
  const address = req.body.address;

  const { compilerVersion, solcJsonInput, contractName } =
    await processRequestFromEtherscan(chain, address);

  const metadata = await getMetadataFromCompiler(
    compilerVersion,
    solcJsonInput,
    contractName
  );

  const mappedSources = getMappedSourcesFromJsonInput(solcJsonInput);
  const checkedContract = new CheckedContract(metadata, mappedSources);

  const match = await services.verification.verifyDeployed(
    checkedContract,
    chain,
    address
  );

  await services.repository.storeMatch(checkedContract, match);

  res.send({ result: [match] });
}
