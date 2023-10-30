import { Response, Request } from "express";
import {
  ContractWrapperMap,
  SendableContract,
  getSessionJSON,
  isVerifiable,
  verifyContractsInSession,
} from "../../verification.common";
import { isEmpty } from "@ethereum-sourcify/lib-sourcify";
import { BadRequestError } from "../../../../../common/errors";
import { services } from "../../../../services/services";

export async function verifyContractsInSessionEndpoint(
  req: Request,
  res: Response
) {
  const session = req.session;
  if (!session.contractWrappers || isEmpty(session.contractWrappers)) {
    throw new BadRequestError("There are currently no pending contracts.");
  }

  const receivedContracts: SendableContract[] = req.body.contracts;

  const verifiable: ContractWrapperMap = {};
  for (const receivedContract of receivedContracts) {
    const id = receivedContract.verificationId;
    const contractWrapper = session.contractWrappers[id];
    if (contractWrapper) {
      contractWrapper.address = receivedContract.address;
      contractWrapper.chainId = receivedContract.chainId;
      /* contractWrapper.contextVariables = receivedContract.contextVariables; */
      contractWrapper.creatorTxHash = receivedContract.creatorTxHash;
      if (isVerifiable(contractWrapper)) {
        verifiable[id] = contractWrapper;
      }
    }
  }

  await verifyContractsInSession(
    verifiable,
    session,
    services.verification,
    services.repository
  );
  res.send(getSessionJSON(session));
}
