import { StatusCodes } from "http-status-codes";
import { Services } from "../../services/services";
import logger from "../../../common/logger";
import { Request } from "express";
import { TypedResponse, VerificationJob } from "../../types";
import { JobNotFoundError } from "../errors";

interface GetJobRequest extends Request {
  params: {
    verificationId: string;
  };
}

type GetJobResponse = TypedResponse<VerificationJob>;

export async function getJobEndpoint(
  req: GetJobRequest,
  res: GetJobResponse,
): Promise<GetJobResponse> {
  logger.debug("getJobEndpoint", {
    verificationId: req.params.verificationId,
  });
  const services = req.app.get("services") as Services;

  const job = await services.storage.performServiceOperation(
    "getVerificationJob",
    [req.params.verificationId],
  );

  if (!job) {
    throw new JobNotFoundError(
      `No verification job found for id ${req.params.verificationId}`,
    );
  }

  return res.status(StatusCodes.OK).json(job);
}
