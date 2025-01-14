import { StatusCodes } from "http-status-codes";
import { Services } from "../../services/services";
import logger from "../../../common/logger";
import { Request } from "express";
import {
  Pagination,
  TypedResponse,
  VerifiedContractMinimal,
} from "../../types";

interface ListContractsRequest extends Request {
  params: {
    chainId: string;
  };
  query: {
    page?: string;
    limit?: string;
    sort?: string;
  };
}

type ListContractsResponse = TypedResponse<{
  results: VerifiedContractMinimal[];
  pagination: Pagination;
}>;

export async function listContractsEndpoint(
  req: ListContractsRequest,
  res: ListContractsResponse,
): Promise<ListContractsResponse> {
  logger.debug("listContractsEndpoint", {
    chainId: req.params.chainId,
    page: req.query.page,
    limit: req.query.limit,
    sort: req.query.sort,
  });
  const services = req.app.get("services") as Services;

  const contracts = await services.storage.performServiceOperation(
    "getPaginatedContracts",
    [
      req.params.chainId,
      parseInt(req.query.page || "0"),
      parseInt(req.query.limit || "200"),
      req.query.sort === "desc" || !req.query.sort,
    ],
  );

  return res.status(StatusCodes.OK).json(contracts);
}
