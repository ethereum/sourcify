import { Response, Request } from "express";
import { extractFiles } from "../../verification.common";
import {
  VyperCheckedContract,
  IVyperCompiler,
  StringMap,
  VyperSettings,
} from "@ethereum-sourcify/lib-sourcify";
import { NotFoundError, BadRequestError } from "../../../../../common/errors";
import { getResponseMatchFromMatch } from "../../../../common";
import { Services } from "../../../../services/services";
import { ChainRepository } from "../../../../../sourcify-chain-repository";
import logger from "../../../../../common/logger";

export type VerifyVyperRequest = Omit<Request, "body"> & {
  body: {
    files: Record<string, string>;
    compilerVersion: string;
    compilerSettings: VyperSettings;
    contractPath: string;
    contractName: string;
    address: string;
    creatorTxHash: string;
    chain: string;
  };
};

export async function verifyVyper(
  req: VerifyVyperRequest,
  res: Response,
): Promise<any> {
  const services = req.app.get("services") as Services;
  const vyperCompiler = req.app.get("vyper") as IVyperCompiler;
  const chainRepository = req.app.get("chainRepository") as ChainRepository;

  const inputFiles = extractFiles(req);
  if (!inputFiles || !inputFiles.length) {
    const msg =
      "Couldn't extract files from the request. Please make sure you have added files";
    throw new NotFoundError(msg);
  }

  let checkedContract: VyperCheckedContract;
  try {
    const sources = inputFiles.reduce((files, file) => {
      files[file.path] = file.buffer.toString();
      return files;
    }, {} as StringMap);

    checkedContract = new VyperCheckedContract(
      vyperCompiler,
      req.body.compilerVersion,
      req.body.contractPath,
      req.body.contractName,
      req.body.compilerSettings,
      sources,
    );
  } catch (error: any) {
    logger.warn("Error initializing Vyper compiler input", {
      error: error,
    });
    throw new BadRequestError(
      "Error initializing Vyper compiler input, please check files and settings",
    );
  }

  const match = await services.verification.verifyDeployed(
    checkedContract,
    chainRepository.sourcifyChainMap[req.body.chain],
    req.body.address,
    req.body.creatorTxHash,
  );
  if (match.runtimeMatch || match.creationMatch) {
    await services.storage.storeMatch(checkedContract, match);
  }
  return res.send({ result: [getResponseMatchFromMatch(match)] });
}
