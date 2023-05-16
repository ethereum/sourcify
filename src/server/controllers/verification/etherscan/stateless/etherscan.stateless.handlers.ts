import { Response, Request } from "express";
import verificationService from "../../../../services/VerificationService";
import repositoryService from "../../../../services/RepositoryService";
import { CheckedContract } from "@ethereum-sourcify/lib-sourcify";
import {
  getMappedSourcesFromJsonInput,
  getMetadataFromCompiler,
  processRequestFromEtherscan,
} from "../etherscan.common";
import { checkSupportedChainId } from "../../../../../sourcify-chains";

export async function verifyFromEtherscan(req: Request, res: Response) {
  checkSupportedChainId(req.body.chainId);

  const chain = req.body.chainId as string;
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

  const match = await verificationService.verifyDeployed(
    checkedContract,
    chain,
    address
  );

  await repositoryService.storeMatch(checkedContract, match);

  res.send({ result: [match] });
}
