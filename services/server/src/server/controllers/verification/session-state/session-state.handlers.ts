import { Response, Request } from "express";
import {
  ContractWrapperMap,
  FILE_ENCODING,
  SendableContract,
  addRemoteFile,
  checkContractsInSession,
  extractFiles,
  getSessionJSON,
  isVerifiable,
  saveFilesToSession,
  verifyContractsInSession,
} from "../verification.common";
import {
  PathBuffer,
  PathContent,
  getIpfsGateway,
  isEmpty,
  performFetch,
} from "@ethereum-sourcify/lib-sourcify";
import { BadRequestError, ValidationError } from "../../../../common/errors";

import { StatusCodes } from "http-status-codes";
import { decode as bytecodeDecode } from "@ethereum-sourcify/bytecode-utils";
import logger from "../../../../common/logger";

export async function getSessionDataEndpoint(req: Request, res: Response) {
  res.send(getSessionJSON(req.session));
}

export async function addInputFilesEndpoint(req: Request, res: Response) {
  logger.debug("addInputFilesEndpoint");
  let inputFiles: PathBuffer[] | undefined;
  if (req.query.url) {
    inputFiles = await addRemoteFile(req.query);
  } else {
    inputFiles = extractFiles(req, true);
  }
  if (!inputFiles) throw new ValidationError("No files found");
  const pathContents: PathContent[] = inputFiles.map((pb) => {
    return { path: pb.path, content: pb.buffer.toString(FILE_ENCODING) };
  });

  const dryRun = Boolean(req.query.dryrun);
  const session = req.session;
  const newFilesCount = saveFilesToSession(pathContents, session);
  if (newFilesCount) {
    await checkContractsInSession(session);
    await verifyContractsInSession(
      session.contractWrappers,
      session,
      req.services.verification,
      req.services.storage,
      dryRun
    );
  }
  res.send(getSessionJSON(session));
}

export async function restartSessionEndpoint(req: Request, res: Response) {
  logger.debug("Restarting session", { sessionId: req.session.id });
  req.session.destroy((error: Error) => {
    let msg = "";
    let statusCode = null;

    if (error) {
      msg = "Error in clearing session";
      statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    } else {
      msg = "Session successfully cleared";
      statusCode = StatusCodes.OK;
    }

    res.status(statusCode).send(msg);
  });
}

export async function addInputContractEndpoint(req: Request, res: Response) {
  const address: string = req.body.address;
  const chainId: string = req.body.chainId;

  const sourcifyChain = req.services.verification.supportedChainsMap[chainId];

  const bytecode = await sourcifyChain.getBytecode(address);

  const { ipfs: metadataIpfsCid } = bytecodeDecode(bytecode);

  if (!metadataIpfsCid) {
    throw new BadRequestError("The contract doesn't have a metadata IPFS CID");
  }

  const ipfsUrl = `${getIpfsGateway()}${metadataIpfsCid}`;
  const metadataFileName = "metadata.json";
  const retrievedMetadataText = await performFetch(ipfsUrl);

  if (!retrievedMetadataText) {
    logger.info("Could not retrieve metadata", { ipfsUrl });
    throw new Error(`Could not retrieve metadata from ${metadataIpfsCid}`);
  }
  const pathContents: PathContent[] = [];

  const retrievedMetadataBase64 = Buffer.from(retrievedMetadataText).toString(
    "base64"
  );

  pathContents.push({
    path: metadataFileName,
    content: retrievedMetadataBase64,
  });

  const session = req.session;

  const newFilesCount = saveFilesToSession(pathContents, session);
  if (newFilesCount) {
    await checkContractsInSession(session);
    // verifyValidated fetches missing files from the contract
    await verifyContractsInSession(
      session.contractWrappers,
      session,
      req.services.verification,
      req.services.storage
    );
  }
  res.send(getSessionJSON(session));
}
