import { Response, Request, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ContractData, FilesInfo, MatchLevel } from "../../types";
import { NotFoundError } from "../../../common/errors";
import { Match } from "@ethereum-sourcify/lib-sourcify";
import { services } from "../../services/services";

type RetrieveMethod = (
  chain: string,
  address: string,
  match: MatchLevel
) => Promise<FilesInfo<any>>;
type ConractRetrieveMethod = (chain: string) => Promise<ContractData>;

export function createEndpoint(
  retrieveMethod: RetrieveMethod,
  match: MatchLevel,
  reportMatchStatus = false
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let retrieved: FilesInfo<any>;
    try {
      retrieved = await retrieveMethod(
        req.params.chain,
        req.params.address,
        match
      );
      if (retrieved.files.length === 0)
        return next(new NotFoundError("Files have not been found!"));
    } catch (err: any) {
      return next(new NotFoundError(err.message));
    }
    return res
      .status(StatusCodes.OK)
      .json(reportMatchStatus ? retrieved : retrieved.files);
  };
}

export function createContractEndpoint(
  contractRetrieveMethod: ConractRetrieveMethod
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let retrieved: ContractData;
    try {
      retrieved = await contractRetrieveMethod(req.params.chain);
      if (retrieved.full.length === 0 && retrieved.partial.length === 0)
        return next(new NotFoundError("Contracts have not been found!"));
    } catch (err: any) {
      return next(new NotFoundError(err.message));
    }
    return res.status(StatusCodes.OK).json(retrieved);
  };
}

export function checkAllByChainAndAddressEndpoint(req: any, res: Response) {
  const map: Map<string, any> = new Map();
  const addresses = req.query.addresses.split(",");
  const chainIds = req.query.chainIds.split(",");
  for (const address of addresses) {
    for (const chainId of chainIds) {
      try {
        const found: Match[] = services.repository.checkAllByChainAndAddress(
          address,
          chainId
        );
        if (found.length != 0) {
          if (!map.has(address)) {
            map.set(address, {
              address,
              create2Args: found[0].create2Args,
              chainIds: [],
            });
          }

          map.get(address).chainIds.push({ chainId, status: found[0].status });
        }
      } catch (error) {
        // ignore
      }
    }
    if (!map.has(address)) {
      map.set(address, {
        address: address,
        status: "false",
      });
    }
  }
  const resultArray = Array.from(map.values());
  res.send(resultArray);
}

export function checkByChainAndAddressesEnpoint(req: any, res: Response) {
  const map: Map<string, any> = new Map();
  const addresses = req.query.addresses.split(",");
  const chainIds = req.query.chainIds.split(",");
  for (const address of addresses) {
    for (const chainId of chainIds) {
      try {
        const found: Match[] = services.repository.checkByChainAndAddress(
          address,
          chainId
        );
        if (found.length != 0) {
          if (!map.has(address)) {
            map.set(address, { address, status: "perfect", chainIds: [] });
          }

          map.get(address).chainIds.push(chainId);
        }
      } catch (error) {
        // ignore
      }
    }
    if (!map.has(address)) {
      map.set(address, {
        address: address,
        status: "false",
      });
    }
  }
  const resultArray = Array.from(map.values());
  res.send(resultArray);
}
