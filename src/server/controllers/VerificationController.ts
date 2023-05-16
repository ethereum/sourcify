import { NextFunction, Request, Response, Router } from "express";
import cors from "cors";
import {
  SourcifyChainMap,
  CheckedContract,
  checkFiles,
  useAllSources,
  PathBuffer,
  PathContent,
  isEmpty,
  getBytecode,
  getIpfsGateway,
  performFetch,
  verifyCreate2,
  getAllMetadataAndSourcesFromSolcJson,
} from "@ethereum-sourcify/lib-sourcify";
import { decode as bytecodeDecode } from "@ethereum-sourcify/bytecode-utils";
import { IVerificationService } from "../services/VerificationService";
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
  processRequestFromEtherscan,
  getMappedSourcesFromJsonInput,
  stringToBase64,
  Create2VerifyRequest,
  extractFilesFromJSON,
  SessionCreate2VerifyRequest,
  getMetadataFromCompiler,
} from "./VerificationController-util";
import { body } from "express-validator";
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "../../common/errors";
import {
  checkSupportedChainId,
  sourcifyChainsMap,
} from "../../sourcify-chains";
import config from "../../config";
import { StatusCodes } from "http-status-codes";
import { IRepositoryService } from "../services/RepositoryService";

export default class VerificationController
  extends BaseController
  implements IController
{
  router: Router;
  sourcifyChainsMap: SourcifyChainMap;
  verificationService: IVerificationService;
  repositoryService: IRepositoryService;

  constructor(
    verificationService: IVerificationService,
    repositoryService: IRepositoryService
  ) {
    super();
    this.verificationService = verificationService;
    this.repositoryService = repositoryService;
    this.sourcifyChainsMap = sourcifyChainsMap;
    this.router = Router();
  }

  private verifyFromEtherscan = async (
    origReq: Request,
    res: Response
  ): Promise<void> => {
    const req = origReq as LegacyVerifyRequest;
    validateRequest(req);

    const chain = req.body.chain as string;
    const address = req.body.address;

    const { compilerVersion, solcJsonInput, contractName } =
      await processRequestFromEtherscan(chain, address);

    const metadata = await getMetadataFromCompiler(
      compilerVersion,
      solcJsonInput,
      contractName
    );

    const mappedSources = getMappedSourcesFromJsonInput(solcJsonInput);
    const checkedContract = new CheckedContract(metadata, mappedSources);

    const match = await this.verificationService.verifyDeployed(
      checkedContract,
      chain,
      address
    );

    await this.repositoryService.storeMatch(checkedContract, match);

    res.send({ result: [match] });
  };

  private sessionVerifyFromEtherscan = async (
    origReq: Request,
    res: Response
  ): Promise<void> => {
    const req = origReq as LegacyVerifyRequest;
    validateRequest(req);

    const chain = req.body.chainId as string;
    const address = req.body.address;

    const { compilerVersion, solcJsonInput, contractName } =
      await processRequestFromEtherscan(chain, address);

    const metadata = await getMetadataFromCompiler(
      compilerVersion,
      solcJsonInput,
      contractName
    );

    const pathContents: PathContent[] = Object.keys(solcJsonInput.sources).map(
      (path) => {
        return {
          path: path,
          content: stringToBase64(solcJsonInput.sources[path].content),
        };
      }
    );
    pathContents.push({
      path: "metadata.json",
      content: stringToBase64(JSON.stringify(metadata)),
    });
    const session = req.session;
    const newFilesCount = saveFiles(pathContents, session);
    if (newFilesCount === 0) {
      throw new BadRequestError("The contract didn't add any new file");
    }

    await checkContractsInSession(session);
    if (!session.contractWrappers) {
      throw new BadRequestError(
        "Unknown error during the Etherscan verification process"
      );
      return;
    }

    const verifiable: ContractWrapperMap = {};
    for (const id of Object.keys(session.contractWrappers)) {
      const contractWrapper = session.contractWrappers[id];
      if (contractWrapper) {
        if (!contractWrapper.address) {
          contractWrapper.address = address;
          contractWrapper.chainId = chain;
        }
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
    // Session APIs with session cookies require non "*" CORS

    this.router.route(["/verify/etherscan"]).post(
      body("address")
        .exists()
        .bail()
        .custom(
          (address, { req }) => (req.addresses = validateAddresses(address))
        ),
      body("chainId")
        .optional()
        .custom(
          (chainId, { req }) =>
            // Support both `body.chain` and `body.chainId`
            // `checkChainId` won't be checked here but in the next `req.body.chain` check below to avoid duplicate error messages
            (req.body.chain = chainId)
        ),
      body("chain")
        .exists()
        .bail()
        .custom((chain) => checkSupportedChainId(chain)),
      this.safeHandler(this.verifyFromEtherscan)
    );

    this.router.route(["/session/verify/etherscan"]).post(
      body("address")
        .exists()
        .bail()
        .custom(
          (address, { req }) =>
            (req.body.addresses = validateAddresses(address))
        ),
      body("chain")
        .optional()
        .custom(
          (chain, { req }) =>
            // Support both `body.chain` and `body.chainId`
            (req.body.chainId = chain)
        ),
      body("chainId")
        .exists()
        .bail()
        .custom((chainId) => checkSupportedChainId(chainId)),
      this.safeHandler(this.sessionVerifyFromEtherscan)
    );

    return this.router;
  };
}
