import { Response, Request } from "express";
import {
  ContractWrapperMap,
  checkContractsInSession,
  getSessionJSON,
  isVerifiable,
  saveFilesToSession,
  verifyContractsInSession,
} from "../../verification.common";
import { ISolidityCompiler, PathContent } from "@ethereum-sourcify/lib-sourcify";
import { BadRequestError } from "../../../../../common/errors";
import {
  getMetadataFromCompiler,
  processRequestFromEtherscan,
  stringToBase64,
} from "../etherscan.common";
import logger from "../../../../../common/logger";
import { ChainRepository } from "../../../../../sourcify-chain-repository";

export async function sessionVerifyFromEtherscan(req: Request, res: Response) {
  logger.info("sessionVerifyFromEtherscan", {
    chainId: req.body.chain,
    address: req.body.address,
  });

  const chainRepository = req.app.get('chainRepository') as ChainRepository;
  const solc = req.app.get('solc') as ISolidityCompiler;

  chainRepository.checkSupportedChainId(req.body.chain);

  const chain = req.body.chain;
  const address = req.body.address;
  const apiKey = req.body.apiKey;
  const sourcifyChain = chainRepository.supportedChainMap[chain];

  const { compilerVersion, solcJsonInput, contractName } =
    await processRequestFromEtherscan(sourcifyChain, address, apiKey);

  const metadata = await getMetadataFromCompiler(
    solc,
    compilerVersion,
    solcJsonInput,
    contractName,
  );

  const pathContents: PathContent[] = Object.keys(solcJsonInput.sources).map(
    (path) => {
      return {
        path: path,
        content: stringToBase64(solcJsonInput.sources[path].content),
      };
    },
  );
  pathContents.push({
    path: "metadata.json",
    content: stringToBase64(JSON.stringify(metadata)),
  });
  const session = req.session;
  const newFilesCount = saveFilesToSession(pathContents, session);
  if (newFilesCount === 0) {
    throw new BadRequestError("The contract didn't add any new file");
  }

  await checkContractsInSession(solc, session);
  if (!session.contractWrappers) {
    throw new BadRequestError(
      "Unknown error during the Etherscan verification process",
    );
    return;
  }

  const verifiable: ContractWrapperMap = {};
  for (const id of Object.keys(session.contractWrappers)) {
    const contractWrapper = session.contractWrappers[id];
    if (contractWrapper) {
      if (!contractWrapper.address) {
        contractWrapper.address = address;
        contractWrapper.chainId = chain;
      }
      if (isVerifiable(contractWrapper)) {
        verifiable[id] = contractWrapper;
      }
    }
  }

  await verifyContractsInSession(
    solc,
    verifiable,
    session,
    req.services.verification,
    req.services.storage,
  );
  res.send(getSessionJSON(session));
}
