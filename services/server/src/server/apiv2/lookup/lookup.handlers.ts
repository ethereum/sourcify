import { StatusCodes } from "http-status-codes";
import { Services } from "../../services/services";
import logger from "../../../common/logger";
import { Request } from "express";
import {
  TypedResponse,
  VerifiedContract,
  VerifiedContractMinimal,
} from "../../types";

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

interface GetContractRequest extends Request {
  params: {
    chainId: string;
    address: string;
  };
  query: {
    fields?: string;
    omit?: string;
  };
}

type GetContractResponse = TypedResponse<VerifiedContract>;

export async function getContractEndpoint(
  req: GetContractRequest,
  res: GetContractResponse,
): Promise<GetContractResponse> {
  logger.debug("getContractEndpoint", {
    chainId: req.params.chainId,
    address: req.params.address,
    fields: req.query.fields,
    omit: req.query.omit,
  });
  const services = req.app.get("services") as Services;

  const fields = req.query.fields?.split(",");
  const omit = req.query.omit?.split(",");

  const contract = await services.storage.performServiceOperation(
    "getContract",
    [req.params.chainId, req.params.address, fields, omit],
  );

  return res
    .status(contract.match ? StatusCodes.OK : StatusCodes.NOT_FOUND)
    .json(contract);
}
