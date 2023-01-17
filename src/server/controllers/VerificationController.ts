import { Request, Response, Router } from "express";
import {
  SourcifyChainMap,
  CheckedContract,
  checkFiles,
  useAllSources,
} from "@ethereum-sourcify/lib-sourcify";
import VerificationService from "../services/VerificationService";
import BaseController from "./BaseController";
import { IController } from "../../common/interfaces";
import {
  extractFiles,
  LegacyVerifyRequest,
  stringifyInvalidAndMissing,
  validateAddresses,
  validateRequest,
} from "./VerificationController-util";
import { body } from "express-validator";
import { BadRequestError, NotFoundError } from "../../common/errors";
import { checkChainId, sourcifyChainsMap } from "../../sourcify-chains";
import config from "../../config";
import { StatusCodes } from "http-status-codes";
import RepositoryService from "../services/RepositoryService";

export default class VerificationController
  extends BaseController
  implements IController
{
  router: Router;
  sourcifyChainsMap: SourcifyChainMap;
  verificationService: VerificationService;
  repositoryService: RepositoryService;

  static readonly MAX_SESSION_SIZE = 50 * 1024 * 1024; // 50 MiB

  constructor(
    verificationService: VerificationService,
    repositoryService: RepositoryService
  ) {
    super();
    this.verificationService = verificationService;
    this.repositoryService = repositoryService;
    this.sourcifyChainsMap = sourcifyChainsMap;
    this.router = Router();
  }

  private legacyVerifyEndpoint = async (
    origReq: Request,
    res: Response
  ): Promise<any> => {
    // Typecast here because of the type error: Type 'Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>' is not assignable to type 'LegacyVerifyRequest'.
    const req = origReq as LegacyVerifyRequest;
    validateRequest(req); // TODO: Validate below with route registration.

    for (const address of req.addresses) {
      const result = this.repositoryService.checkByChainAndAddress(
        address,
        req.chain
      );
      if (result.length != 0) {
        return res.send({ result });
      }
    }

    const inputFiles = extractFiles(req);
    if (!inputFiles) {
      const msg =
        "Couldn't extract files from the request. Please make sure you have added files";
      throw new NotFoundError(msg);
    }

    let validatedContracts: CheckedContract[];
    try {
      validatedContracts = await checkFiles(inputFiles);
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }

    const errors = validatedContracts
      .filter((contract) => !CheckedContract.isValid(contract, true))
      .map(stringifyInvalidAndMissing);
    if (errors.length) {
      throw new BadRequestError(
        "Invalid or missing sources in:\n" + errors.join("\n")
      );
    }

    if (validatedContracts.length !== 1 && !req.body.chosenContract) {
      const contractNames = validatedContracts.map((c) => c.name).join(", ");
      const msg = `Detected ${validatedContracts.length} contracts (${contractNames}), but can only verify 1 at a time. Please choose a main contract and click Verify again.`;
      const contractsToChoose = validatedContracts.map((contract) => ({
        name: contract.name,
        path: contract.compiledPath,
      }));
      return res
        .status(StatusCodes.BAD_REQUEST)
        .send({ error: msg, contractsToChoose });
    }

    const contract: CheckedContract = req.body.chosenContract
      ? validatedContracts[req.body.chosenContract]
      : validatedContracts[0];

    try {
      const match = await this.verificationService.verifyDeployed(
        contract,
        req.addresses[0], // Due to the old API taking an array of addresses.
        req.body.chain
      );
      // Send to verification again with all source files.
      if (match.status === "extra-file-input-bug") {
        const contractWithAllSources = await useAllSources(
          contract,
          inputFiles
        );
        const tempMatch = await this.verificationService.verifyDeployed(
          contractWithAllSources,
          req.addresses[0], // Due to the old API taking an array of addresses.
          req.body.chain
        );
        if (tempMatch.status === "perfect") {
          // TODO: Save files in repo
          return res.send({ result: [tempMatch] });
        }
      }
      // TODO: Save files in repo
      return res.send({ result: [match] }); // array is an old expected behavior (e.g. by frontend)
    } catch (error: any) {
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .send({ error: error.message });
    }
  };

  registerRoutes = (): Router => {
    const corsOpt = {
      origin: config.corsAllowedOrigins,
      credentials: true,
    };

    this.router.route(["/", "/verify"]).post(
      body("address")
        .exists()
        .bail()
        .custom(
          (address, { req }) => (req.addresses = validateAddresses(address))
        ),
      body("chain")
        .exists()
        .bail()
        .custom((chain, { req }) => (req.chain = checkChainId(chain))),
      body("contextVariables.msgSender").optional(),
      body("contextVariables.abiEncodedConstructorArguments").optional(),
      // Handle non-json multipart/form-data requests.
      body("abiEncodedConstructorArguments")
        .optional()
        .custom(
          (abiEncodedConstructorArguments, { req }) =>
            (req.body.contextVariables = {
              abiEncodedConstructorArguments,
              ...req.body.contextVariables,
            })
        ),
      body("msgSender")
        .optional()
        .custom(
          (msgSender, { req }) =>
            (req.body.contextVariables = {
              msgSender,
              ...req.body.contextVariables,
            })
        ),
      this.safeHandler(this.legacyVerifyEndpoint)
    );
    return this.router;
  };
}
