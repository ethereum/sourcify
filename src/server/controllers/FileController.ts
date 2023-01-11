import { NextFunction, Request, Response, Router } from "express";
import BaseController from "./BaseController";
import { IController } from "../../common/interfaces";
import { StatusCodes } from "http-status-codes";
import {
  IFileService,
  MatchLevel,
  FilesInfo,
  ContractData,
} from "@ethereum-sourcify/core";
import { param, validationResult } from "express-validator";
import {
  isValidAddress,
  isValidChain,
} from "../../common/validators/validators";
import { NotFoundError, ValidationError } from "../../common/errors";

type RetrieveMethod = (
  chain: string,
  address: string,
  match: MatchLevel
) => Promise<FilesInfo<any>>;
type ConractRetrieveMethod = (chain: string) => Promise<ContractData>;

export default class FileController
  extends BaseController
  implements IController
{
  router: Router;
  fileService: IFileService;

  constructor(fileService: IFileService) {
    super();
    this.router = Router();
    this.fileService = fileService;
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

  registerRoutes = (): Router => {
    [
      {
        prefix: "/tree/any",
        method: this.createEndpoint(
          this.fileService.getTree,
          "any_match",
          true
        ),
      },
      {
        prefix: "/any",
        method: this.createEndpoint(
          this.fileService.getContent,
          "any_match",
          true
        ),
      },
      {
        prefix: "/tree",
        method: this.createEndpoint(this.fileService.getTree, "full_match"),
      },
      {
        prefix: "/contracts",
        method: this.createContractEndpoint(this.fileService.getContracts),
      },
      {
        prefix: "",
        method: this.createEndpoint(this.fileService.getContent, "full_match"),
      },
    ].forEach((pair) => {
      const validators = [param("chain").custom(isValidChain)];
      if (pair.prefix != "/contracts")
        validators.push(param("address").custom(isValidAddress));
      this.router
        .route(
          pair.prefix != "/contracts"
            ? pair.prefix + "/:chain/:address"
            : pair.prefix + "/:chain"
        )
        .get(validators, this.safeHandler(pair.method));
    });
    return this.router;
  };
}
