import type {
  VyperJsonInput,
  SolidityJsonInput,
  CompilationTarget,
} from "@ethereum-sourcify/lib-sourcify";
import { TypedResponse } from "../../types";
import logger from "../../../common/logger";
import { Request } from "express";
import { Services } from "../../services/services";
import { StatusCodes } from "http-status-codes";

interface VerifyFromJsonInputRequest extends Request {
  params: {
    chainId: string;
    address: string;
  };
  body: {
    stdJsonInput: SolidityJsonInput | VyperJsonInput;
    compilerVersion: string;
    contractIdentifier: string;
    creationTransactionHash?: string;
  };
}

type VerifyFromJsonInputResponse = TypedResponse<{
  verificationId: string;
}>;

export async function verifyFromJsonInputEndpoint(
  req: VerifyFromJsonInputRequest,
  res: VerifyFromJsonInputResponse,
) {
  logger.debug("verifyFromJsonInputEndpoint", {
    chainId: req.params.chainId,
    address: req.params.address,
    stdJsonInput: req.body.stdJsonInput,
    compilerVersion: req.body.compilerVersion,
    contractIdentifier: req.body.contractIdentifier,
    creationTransactionHash: req.body.creationTransactionHash,
  });

  // The contract path can include a colon itself. Therefore,
  // we need to take the last element as the contract name.
  const splitIdentifier = req.body.contractIdentifier.split(":");
  const contractName = splitIdentifier[splitIdentifier.length - 1];
  const contractPath = splitIdentifier.slice(0, -1).join(":");
  const compilationTarget: CompilationTarget = {
    name: contractName,
    path: contractPath,
  };

  const services = req.app.get("services") as Services;
  const verificationId =
    await services.verification.verifyFromJsonInputViaWorker(
      req.baseUrl + req.path,
      req.params.chainId,
      req.params.address,
      req.body.stdJsonInput,
      req.body.compilerVersion,
      compilationTarget,
      req.body.creationTransactionHash,
    );

  res.status(StatusCodes.ACCEPTED).json({ verificationId });
}
