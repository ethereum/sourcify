import { Response } from "express";
import { services } from "../../../../services/services";
import {
  extractFilesFromJSON,
  stringifyInvalidAndMissing,
} from "../../verification.common";
import {
  CheckedContract,
  checkFiles,
  verifyCreate2,
} from "@ethereum-sourcify/lib-sourcify";
import { BadRequestError } from "../../../../../common/errors";
import { Create2VerifyRequest } from "../create2.common";

export async function verifyCreate2Handler(
  req: Create2VerifyRequest,
  res: Response
) {
  const {
    deployerAddress,
    salt,
    abiEncodedConstructorArguments,
    files,
    create2Address,
  } = req.body;

  const inputFiles = extractFilesFromJSON(files);
  if (!inputFiles) {
    throw new BadRequestError("No files found");
  }

  let checkedContracts: CheckedContract[];
  try {
    checkedContracts = await checkFiles(inputFiles);
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  const errors = checkedContracts
    .filter((contract) => !CheckedContract.isValid(contract, true))
    .map(stringifyInvalidAndMissing);
  if (errors.length) {
    throw new BadRequestError(
      "Invalid or missing sources in:\n" + errors.join("\n")
    );
  }

  const contract: CheckedContract = checkedContracts[0];

  const match = await verifyCreate2(
    contract,
    deployerAddress,
    salt,
    create2Address,
    abiEncodedConstructorArguments
  );

  if (match.status) {
    await services.repository.storeMatch(contract, match);
  }

  res.send({ result: [match] });
}
