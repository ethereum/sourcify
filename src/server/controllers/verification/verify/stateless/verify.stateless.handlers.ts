import { Response } from "express";
import { services } from "../../../../services/services";
import {
  LegacyVerifyRequest,
  extractFiles,
  stringifyInvalidAndMissing,
} from "../../verification.common";
import {
  CheckedContract,
  checkFiles,
  useAllSources,
} from "@ethereum-sourcify/lib-sourcify";
import { BadRequestError, NotFoundError } from "../../../../../common/errors";
import { StatusCodes } from "http-status-codes";

export async function legacyVerifyEndpoint(
  req: LegacyVerifyRequest,
  res: Response
): Promise<any> {
  const result = services.repository.checkByChainAndAddress(
    req.body.address,
    req.body.chain
  );
  if (result.length != 0) {
    return res.send({ result });
  }

  const inputFiles = extractFiles(req);
  if (!inputFiles) {
    const msg =
      "Couldn't extract files from the request. Please make sure you have added files";
    throw new NotFoundError(msg);
  }

  let checkedContracts: CheckedContract[];
  try {
    checkedContracts = await checkFiles(inputFiles);
  } catch (error: any) {
    throw new BadRequestError(error.message);
  }

  const errors = checkedContracts
    .filter((contract) => !CheckedContract.isValid(contract, true))
    .map(stringifyInvalidAndMissing);
  if (errors.length) {
    throw new BadRequestError(
      "Invalid or missing sources in:\n" + errors.join("\n")
    );
  }

  if (checkedContracts.length !== 1 && !req.body.chosenContract) {
    const contractNames = checkedContracts.map((c) => c.name).join(", ");
    const msg = `Detected ${checkedContracts.length} contracts (${contractNames}), but can only verify 1 at a time. Please choose a main contract and click Verify again.`;
    const contractsToChoose = checkedContracts.map((contract) => ({
      name: contract.name,
      path: contract.compiledPath,
    }));
    return res
      .status(StatusCodes.BAD_REQUEST)
      .send({ error: msg, contractsToChoose });
  }

  const contract: CheckedContract = req.body.chosenContract
    ? checkedContracts[req.body.chosenContract]
    : checkedContracts[0];

  try {
    const match = await services.verification.verifyDeployed(
      contract,
      req.body.chain,
      req.body.address,
      /* req.body.contextVariables, */
      req.body.creatorTxHash
    );
    // Send to verification again with all source files.
    if (match.status === "extra-file-input-bug") {
      const contractWithAllSources = await useAllSources(contract, inputFiles);
      const tempMatch = await services.verification.verifyDeployed(
        contractWithAllSources,
        req.body.chain,
        req.body.address,
        req.body.creatorTxHash
      );
      if (tempMatch.status === "perfect") {
        await services.repository.storeMatch(contract, tempMatch);
        return res.send({ result: [tempMatch] });
      }
    }
    if (match.status) {
      await services.repository.storeMatch(contract, match);
    }
    return res.send({ result: [match] }); // array is an old expected behavior (e.g. by frontend)
  } catch (error: any) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send({ error: error.message });
  }
}
