import { Response, Request } from "express";
import { services } from "../../../../services/services";
import { getSessionJSON } from "../../verification.common";
import {
  CheckedContract,
  isEmpty,
  verifyCreate2,
} from "@ethereum-sourcify/lib-sourcify";
import { BadRequestError } from "../../../../../common/errors";
import { SessionCreate2VerifyRequest } from "../create2.common";

export async function sessionVerifyCreate2(
  req: SessionCreate2VerifyRequest,
  res: Response
) {
  const session = req.session;
  if (!session.contractWrappers || isEmpty(session.contractWrappers)) {
    throw new BadRequestError("There are currently no pending contracts.");
  }

  const {
    deployerAddress,
    salt,
    abiEncodedConstructorArguments,
    verificationId,
    create2Address,
  } = req.body;

  const contractWrapper = session.contractWrappers[verificationId];

  const contract = new CheckedContract(
    contractWrapper.contract.metadata,
    contractWrapper.contract.solidity,
    contractWrapper.contract.missing,
    contractWrapper.contract.invalid
  );

  const match = await verifyCreate2(
    contract,
    deployerAddress,
    salt,
    create2Address,
    abiEncodedConstructorArguments
  );

  contractWrapper.status = match.runtimeMatch || "error";
  contractWrapper.statusMessage = match.message;
  contractWrapper.storageTimestamp = match.storageTimestamp;
  contractWrapper.address = match.address;
  contractWrapper.chainId = "0";

  if (match.runtimeMatch) {
    await services.repository.storeMatch(contract, match);
  }

  res.send(getSessionJSON(session));
}

export async function sessionPrecompileContract(req: Request, res: Response) {
  const session = req.session;
  if (!session.contractWrappers || isEmpty(session.contractWrappers)) {
    throw new BadRequestError("There are currently no pending contracts.");
  }

  const verificationId = req.body.verificationId;
  const contractWrapper = session.contractWrappers[verificationId];

  const checkedContract = new CheckedContract(
    contractWrapper.contract.metadata,
    contractWrapper.contract.solidity,
    contractWrapper.contract.missing,
    contractWrapper.contract.invalid
  );

  // While recompiling it also updates the creationBytecode in checkedContract
  await checkedContract.recompile();

  res.send(getSessionJSON(session));
}
