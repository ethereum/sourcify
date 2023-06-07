import { Response, Request } from "express";
import {
  FILE_ENCODING,
  checkContractsInSession,
  extractFiles,
  getSessionJSON,
  saveFiles,
} from "../../verification.common";
import {
  PathContent,
  getAllMetadataAndSourcesFromSolcJson,
} from "@ethereum-sourcify/lib-sourcify";
import { BadRequestError, ValidationError } from "../../../../../common/errors";

export async function addInputSolcJsonEndpoint(req: Request, res: Response) {
  const inputFiles = extractFiles(req, true);
  if (!inputFiles) throw new ValidationError("No files found");

  const compilerVersion = req.body.compilerVersion;

  for (const inputFile of inputFiles) {
    let solcJson;
    try {
      solcJson = JSON.parse(inputFile.buffer.toString());
    } catch (error: any) {
      throw new BadRequestError(
        `Couldn't parse JSON ${inputFile.path}. Make sure the contents of the file are syntaxed correctly.`
      );
    }

    const metadataAndSources = await getAllMetadataAndSourcesFromSolcJson(
      solcJson,
      compilerVersion
    );
    const metadataAndSourcesPathContents: PathContent[] =
      metadataAndSources.map((pb) => {
        return { path: pb.path, content: pb.buffer.toString(FILE_ENCODING) };
      });

    const session = req.session;
    const newFilesCount = saveFiles(metadataAndSourcesPathContents, session);
    if (newFilesCount) {
      await checkContractsInSession(session);
    }
    res.send(getSessionJSON(session));
  }
}
