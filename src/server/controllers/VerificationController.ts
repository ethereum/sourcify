import { Request, Response, Router } from "express";
import cors from "cors";
import {
  SourcifyChainMap,
  CheckedContract,
  checkFiles,
  useAllSources,
  PathBuffer,
  PathContent,
  isEmpty,
} from "@ethereum-sourcify/lib-sourcify";
import VerificationService from "../services/VerificationService";
import BaseController from "./BaseController";
import { IController } from "../../common/interfaces";
import {
  addRemoteFile,
  checkContractsInSession,
  ContractWrapperMap,
  extractFiles,
  FILE_ENCODING,
  getSessionJSON,
  isVerifiable,
  LegacyVerifyRequest,
  saveFiles,
  SendableContract,
  stringifyInvalidAndMissing,
  validateAddresses,
  validateRequest,
  verifyContractsInSession,
} from "./VerificationController-util";
import { body } from "express-validator";
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "../../common/errors";
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

    let checkedContracts: CheckedContract[];
    try {
      checkedContracts = await checkFiles(inputFiles);
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }

    const errors = checkedContracts
      .filter((contract) => !CheckedContract.isValid(contract, true))
      .map(stringifyInvalidAndMissing);
    if (errors.length) {
      throw new BadRequestError(
        "Invalid or missing sources in:\n" + errors.join("\n")
      );
    }

    if (checkedContracts.length !== 1 && !req.body.chosenContract) {
      const contractNames = checkedContracts.map((c) => c.name).join(", ");
      const msg = `Detected ${checkedContracts.length} contracts (${contractNames}), but can only verify 1 at a time. Please choose a main contract and click Verify again.`;
      const contractsToChoose = checkedContracts.map((contract) => ({
        name: contract.name,
        path: contract.compiledPath,
      }));
      return res
        .status(StatusCodes.BAD_REQUEST)
        .send({ error: msg, contractsToChoose });
    }

    const contract: CheckedContract = req.body.chosenContract
      ? checkedContracts[req.body.chosenContract]
      : checkedContracts[0];

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
          await this.repositoryService.storeMatch(contract, tempMatch);
          return res.send({ result: [tempMatch] });
        }
      }
      await this.repositoryService.storeMatch(contract, match);
      return res.send({ result: [match] }); // array is an old expected behavior (e.g. by frontend)
    } catch (error: any) {
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .send({ error: error.message });
    }
  };

  private getSessionDataEndpoint = async (req: Request, res: Response) => {
    res.send(getSessionJSON(req.session));
  };

  private addInputFilesEndpoint = async (req: Request, res: Response) => {
    validateRequest(req);
    let inputFiles: PathBuffer[] | undefined;
    if (req.query.url) {
      inputFiles = await addRemoteFile(req.query);
    } else {
      inputFiles = extractFiles(req, true);
    }
    if (!inputFiles)
      throw new ValidationError([{ param: "files", msg: "No files found" }]);
    const pathContents: PathContent[] = inputFiles.map((pb) => {
      return { path: pb.path, content: pb.buffer.toString(FILE_ENCODING) };
    });

    const session = req.session;
    const newFilesCount = saveFiles(pathContents, session);
    if (newFilesCount) {
      await checkContractsInSession(session);
      await verifyContractsInSession(
        session.contractWrappers,
        session,
        this.verificationService,
        this.repositoryService
      );
    }
    res.send(getSessionJSON(session));
  };

  private restartSessionEndpoint = async (req: Request, res: Response) => {
    req.session.destroy((error: Error) => {
      let msg = "";
      let statusCode = null;

      if (error) {
        msg = "Error in clearing session";
        statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
      } else {
        msg = "Session successfully cleared";
        statusCode = StatusCodes.OK;
      }

      res.status(statusCode).send(msg);
    });
  };

  private verifyContractsInSessionEndpoint = async (
    req: Request,
    res: Response
  ) => {
    const session = req.session;
    if (!session.contractWrappers || isEmpty(session.contractWrappers)) {
      throw new BadRequestError("There are currently no pending contracts.");
    }

    const receivedContracts: SendableContract[] = req.body.contracts;

    const verifiable: ContractWrapperMap = {};
    for (const receivedContract of receivedContracts) {
      const id = receivedContract.verificationId;
      const contractWrapper = session.contractWrappers[id];
      if (contractWrapper) {
        contractWrapper.address = receivedContract.address;
        contractWrapper.chainId = receivedContract.chainId;
        contractWrapper.contextVariables = receivedContract.contextVariables;
        if (isVerifiable(contractWrapper)) {
          verifiable[id] = contractWrapper;
        }
      }
    }

    await verifyContractsInSession(
      verifiable,
      session,
      this.verificationService,
      this.repositoryService
    );
    res.send(getSessionJSON(session));
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

    // Session APIs with session cookies require non "*" CORS
    this.router
      .route(["/session-data", "/session/data"])
      .all(cors(corsOpt))
      .get(cors(corsOpt), this.safeHandler(this.getSessionDataEndpoint));

    this.router
      .route(["/input-files", "/session/input-files"])
      .all(cors(corsOpt))
      .post(cors(corsOpt), this.safeHandler(this.addInputFilesEndpoint));

    /* this.router
      .route(["/session/input-contract"])
      .all(cors(corsOpt))
      .post(cors(corsOpt), this.safeHandler(this.addInputContractEndpoint)); */

    this.router
      .route(["/restart-session", "/session/clear"])
      .all(cors(corsOpt))
      .post(cors(corsOpt), this.safeHandler(this.restartSessionEndpoint));

    this.router
      .route([
        "/verify-validated",
        "/session/verify-validated",
        "/session/verify-checked",
      ])
      .all(cors(corsOpt))
      .post(
        body("contracts").isArray(),
        cors(corsOpt),
        this.safeHandler(this.verifyContractsInSessionEndpoint)
      );

    return this.router;
  };
}
