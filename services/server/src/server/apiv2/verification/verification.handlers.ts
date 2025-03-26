import {
  VyperJsonInput,
  SolidityJsonInput,
  CompilationLanguage,
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

  const services = req.app.get("services") as Services;
  const verificationId =
    await services.verification.verifyFromJsonInputViaWorker(
      req.baseUrl + req.path,
      req.params.chainId,
      req.params.address,
      req.body.stdJsonInput,
      req.body.compilerVersion,
      req.body.contractIdentifier,
      req.body.creationTransactionHash,
    );

  res.status(StatusCodes.ACCEPTED).json({ verificationId });
}
