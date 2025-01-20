import { StatusCodes } from "http-status-codes";
import { Services } from "../../services/services";
import logger from "../../../common/logger";
import { Request } from "express";
import { TypedResponse, VerifiedContractMinimal } from "../../types";

interface ListContractsRequest extends Request {
  params: {
    chainId: string;
  };
  query: {
    limit?: string;
    sort?: string;
    afterMatchId?: string;
  };
}

type ListContractsResponse = TypedResponse<{
  results: VerifiedContractMinimal[];
}>;

export async function listContractsEndpoint(
  req: ListContractsRequest,
  res: ListContractsResponse,
): Promise<ListContractsResponse> {
  logger.debug("listContractsEndpoint", {
    chainId: req.params.chainId,
    limit: req.query.limit,
    sort: req.query.sort,
    afterMatchId: req.query.afterMatchId,
  });
  const services = req.app.get("services") as Services;

  const contracts = await services.storage.performServiceOperation(
    "getContractsByChainId",
    [
      req.params.chainId,
      parseInt(req.query.limit || "200"),
      req.query.sort === "desc" || !req.query.sort,
      req.query.afterMatchId,
    ],
  );

  return res.status(StatusCodes.OK).json(contracts);
}
