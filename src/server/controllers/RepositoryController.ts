import { NextFunction, Request, Response, Router } from "express";
import BaseController from "./BaseController";
import { IController } from "../../common/interfaces";
import { StatusCodes } from "http-status-codes";
import { IRepositoryService } from "../services/RepositoryService";
import { param, query, validationResult } from "express-validator";
import { ContractData, FilesInfo, MatchLevel } from "../types";
import {
  isValidAddress,
  isValidChain,
} from "../../common/validators/validators";
import { NotFoundError, ValidationError } from "../../common/errors";
import { Match } from "@ethereum-sourcify/lib-sourcify";
import {
  validateAddresses,
  validateChainIds,
  validateRequest,
} from "../common";

type RetrieveMethod = (
  chain: string,
  address: string,
  match: MatchLevel
) => Promise<FilesInfo<any>>;
type ConractRetrieveMethod = (chain: string) => Promise<ContractData>;

const REPOSITORY_CONTROLLER_PREFIX = "/files";
export default class RepositoryController
  extends BaseController
  implements IController
{
  router: Router;
  repositoryService: IRepositoryService;

  constructor(repositoryService: IRepositoryService) {
    super();
    this.router = Router();
    this.repositoryService = repositoryService;
  }

  createEndpoint(
    retrieveMethod: RetrieveMethod,
    match: MatchLevel,
    reportStatus = false
  ) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return next(new ValidationError(validationErrors.array()));
      }
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
        .json(reportStatus ? retrieved : retrieved.files);
    };
  }

  createContractEndpoint(contractRetrieveMethod: ConractRetrieveMethod) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return next(new ValidationError(validationErrors.array()));
      }
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

  private checkAllByChainAndAddressEndpoint = async (
    req: any,
    res: Response
  ) => {
    validateRequest(req);
    const map: Map<string, any> = new Map();
    for (const address of req.addresses) {
      for (const chainId of req.chainIds) {
        try {
          const found: Match[] =
            this.repositoryService.checkAllByChainAndAddress(address, chainId);
          if (found.length != 0) {
            if (!map.has(address)) {
              map.set(address, {
                address,
                create2Args: found[0].create2Args,
                chainIds: [],
              });
            }

            map
              .get(address)
              .chainIds.push({ chainId, status: found[0].status });
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
  };

  private checkByChainAndAddressesEnpoint = async (req: any, res: Response) => {
    validateRequest(req);
    const map: Map<string, any> = new Map();
    for (const address of req.addresses) {
      for (const chainId of req.chainIds) {
        try {
          const found: Match[] = this.repositoryService.checkByChainAndAddress(
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
  };

  registerRoutes = (): Router => {
    return this.router;
  };
}
