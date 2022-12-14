import { Request, Response, Router } from "express";
import { decode } from "@ethereum-sourcify/bytecode-utils";
import BaseController from "./BaseController";
import { IController } from "../../common/interfaces";
import { IVerificationService } from "@ethereum-sourcify/verification";
import {
  InjectorInput,
  checkChainId,
  PathBuffer,
  CheckedContract,
  performFetch,
  isEmpty,
  PathContent,
  Match,
  Metadata,
  JsonInput,
} from "@ethereum-sourcify/core";
import {
  BadRequestError,
  NotFoundError,
  PayloadTooLargeError,
  ValidationError,
} from "../../common/errors";
import { IValidationService } from "@ethereum-sourcify/validation";
import fileUpload from "express-fileupload";
import { isValidAddress } from "../../common/validators/validators";
import {
  MySession,
  getSessionJSON,
  generateId,
  isVerifiable,
  SendableContract,
  ContractWrapperMap,
  updateUnused,
  MyRequest,
  addRemoteFile,
  contractHasMultipleFiles,
  EtherscanResult,
} from "./VerificationController-util";
import { StatusCodes } from "http-status-codes";
import { body, query, validationResult } from "express-validator";
import web3utils from "web3-utils";
import cors from "cors";
import config from "../../config";
import fetch from "node-fetch";
import { NextFunction } from "express";

const FILE_ENCODING = "base64";
const IPFS_GATEWAY = process.env.IPFS_GATEWAY || "https://ipfs.io/ipfs/";

export default class VerificationController
  extends BaseController
  implements IController
{
  router: Router;
  verificationService: IVerificationService;
  validationService: IValidationService;

  static readonly MAX_SESSION_SIZE = 50 * 1024 * 1024; // 50 MiB

  constructor(
    verificationService: IVerificationService,
    validationService: IValidationService
  ) {
    super();
    this.router = Router();
    this.verificationService = verificationService;
    this.validationService = validationService;
  }

  private validateAddresses(addresses: string): string[] {
    const addressesArray = addresses.split(",");
    const invalidAddresses: string[] = [];
    for (const i in addressesArray) {
      const address = addressesArray[i];
      if (!isValidAddress(address)) {
        invalidAddresses.push(address);
      } else {
        addressesArray[i] = web3utils.toChecksumAddress(address);
      }
    }

    if (invalidAddresses.length) {
      throw new Error(`Invalid addresses: ${invalidAddresses.join(", ")}`);
    }
    return addressesArray;
  }

  private validateSingleChainId(chainId: string): string {
    return checkChainId(chainId);
  }

  private validateChainIds(chainIds: string): string[] {
    const chainIdsArray = chainIds.split(",");
    const validChainIds: string[] = [];
    const invalidChainIds: string[] = [];
    for (const chainId of chainIdsArray) {
      try {
        if (chainId === "0") {
          // create2 verified contract
          validChainIds.push("0");
        } else {
          validChainIds.push(checkChainId(chainId));
        }
      } catch (e) {
        invalidChainIds.push(chainId);
      }
    }

    if (invalidChainIds.length) {
      throw new Error(`Invalid chainIds: ${invalidChainIds.join(", ")}`);
    }
    return validChainIds;
  }

  private stringifyInvalidAndMissing(contract: CheckedContract) {
    const errors = Object.keys(contract.invalid).concat(
      Object.keys(contract.missing)
    );
    return `${contract.name} (${errors.join(", ")})`;
  }

  private getMappedSourcesFromJsonInput = (jsonInput: JsonInput) => {
    const mappedSources: any = {};
    for (const name in jsonInput.sources) {
      const source = jsonInput.sources[name];
      if (source.content) {
        mappedSources[name] = source.content;
      }
    }
    return mappedSources;
  };

  private getEtherscanApiHostFromChainId = (chainId: string): string | null => {
    switch (chainId) {
      case "1":
        return `https://api.etherscan.io`;
      case "5":
        return `https://api-goerli.etherscan.io`;
      case "4":
        return `https://api-rinkeby.etherscan.io`;
      case "11155111":
        return `https://api-sepolia.etherscan.io`;
      default:
        return null;
    }
  };

  private getSolcJsonInputFromEtherscanResult = (
    etherscanResult: EtherscanResult,
    contractPath: string
  ): JsonInput => {
    const generatedSettings = {
      optimizer: {
        enabled: etherscanResult.OptimizationUsed === "1",
        runs: parseInt(etherscanResult.Runs),
      },
      outputSelection: {
        "*": {
          "*": ["metadata"],
        },
      },
      evmVersion:
        etherscanResult.EVMVersion.toLowerCase() !== "default"
          ? etherscanResult.EVMVersion
          : undefined,
      libraries: {}, // TODO: Check the library format
    };
    const solcJsonInput = {
      language: "Solidity",
      sources: {
        [contractPath]: {
          content: etherscanResult.SourceCode,
        },
      },
      settings: generatedSettings,
    };
    return solcJsonInput;
  };

  // Output has multiple curly braces {{...}}
  private parseMultipleFilesContract = (sourceCodeObject: string) => {
    return JSON.parse(sourceCodeObject.slice(1, -1));
  };

  private processRequestFromEtherscan = async (
    chain: string,
    address: string
  ): Promise<any> => {
    const url = `${this.getEtherscanApiHostFromChainId(
      chain
    )}/api?module=contract&action=getsourcecode&address=${address}&apikey=${
      config.server.etherscanAPIKey
    }`;

    const response = await fetch(url);
    const resultJson = await response.json();
    if (
      resultJson.message === "NOTOK" &&
      resultJson.result.includes("Max rate limit reached")
    ) {
      throw new BadRequestError("Etherscan API rate limit reached, try later");
    }
    if (resultJson.result[0].SourceCode === "") {
      throw new BadRequestError("This contract is not verified on Etherscan");
    }
    const contractResultJson = resultJson.result[0];
    const sourceCodeObject = contractResultJson.SourceCode;
    const compilerVersion =
      contractResultJson.CompilerVersion.charAt(0) === "v"
        ? contractResultJson.CompilerVersion.slice(1)
        : contractResultJson.CompilerVersion;
    const contractName = contractResultJson.ContractName;

    let solcJsonInput;
    // SourceCode can be the Solidity code if there is only one contract file, or the json object if there are multiple files
    if (contractHasMultipleFiles(sourceCodeObject)) {
      solcJsonInput = this.parseMultipleFilesContract(sourceCodeObject);
      // Tell compiler to output metadata
      solcJsonInput.settings.outputSelection["*"]["*"] = ["metadata"];
    } else {
      const contractPath = contractResultJson.ContractName + ".sol";
      solcJsonInput = this.getSolcJsonInputFromEtherscanResult(
        contractResultJson,
        contractPath
      );
    }

    const metadata = await this.verificationService.getMetadataFromJsonInput(
      compilerVersion,
      contractName,
      solcJsonInput
    );
    return {
      metadata,
      solcJsonInput,
    };
  };

  private verifyFromEtherscan = async (
    origReq: Request,
    res: Response
  ): Promise<void> => {
    const req = origReq as MyRequest;
    this.validateRequest(req);

    const chain = req.body.chainId as string;
    const address = req.body.address;

    const { metadata, solcJsonInput } = await this.processRequestFromEtherscan(
      chain,
      address
    );

    const mappedSources = this.getMappedSourcesFromJsonInput(solcJsonInput);
    const checkedContract = new CheckedContract(metadata, mappedSources);

    const injectorInput: InjectorInput = {
      chain,
      addresses: [address],
      contract: checkedContract,
    };

    const result = await this.verificationService.inject(injectorInput);
    res.send({ result: [result] });
  };

  private verifyCreate2 = async (
    origReq: Request,
    res: Response
  ): Promise<void> => {
    const req = origReq as MyRequest;
    this.validateRequest(req);

    const deployerAddress = req.body.deployerAddress;
    const salt = req.body.salt;
    const constructorArgs = req.body.constructorArgs || [];
    const baseContract = req.body.baseContract || null;
    const files = req.body.files || null;
    const create2Address = req.body.create2Address;

    if (files !== null) {
      const inputFiles = this.extractFilesFromJSON(files);
      if (!inputFiles) {
        const msg =
          "The contract at the provided address and chain has not yet been sourcified.";
        throw new NotFoundError(msg);
      }

      let validatedContracts: CheckedContract[];
      try {
        validatedContracts = await this.validationService.checkFiles(
          inputFiles
        );
      } catch (error: any) {
        throw new BadRequestError(error.message);
      }

      const errors = validatedContracts
        .filter((contract) => !CheckedContract.isValid(contract, true))
        .map(this.stringifyInvalidAndMissing);
      if (errors.length) {
        throw new BadRequestError(
          "Invalid or missing sources in:\n" + errors.join("\n")
        );
      }

      const contract: CheckedContract = validatedContracts[0];

      const result = await this.verificationService.verifyCreate2(
        contract,
        deployerAddress,
        salt,
        constructorArgs,
        create2Address
      );
      res.send({ result: [result] });
    } else if (baseContract !== null) {
      // TODO: verification with already verified contract
    } else {
      res.send({ result: "pass either address or files" });
    }
  };

  private sessionVerifyCreate2 = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const session = req.session as MySession;
    if (!session.contractWrappers || isEmpty(session.contractWrappers)) {
      throw new BadRequestError("There are currently no pending contracts.");
    }

    const deployerAddress = req.body.deployerAddress;
    const salt = req.body.salt;
    const constructorArgs = req.body.constructorArgs || [];

    const verificationId = req.body.verificationId;
    const create2Address = req.body.create2Address;
    const contractWrapper = session.contractWrappers[verificationId];

    const contract: CheckedContract = contractWrapper.contract;

    const match = await this.verificationService.verifyCreate2(
      contract,
      deployerAddress,
      salt,
      constructorArgs,
      create2Address
    );

    contractWrapper.status = match.status || "error";
    contractWrapper.statusMessage = match.message;
    contractWrapper.storageTimestamp = match.storageTimestamp;
    contractWrapper.address = match.address;

    res.send(getSessionJSON(session));
  };

  private sessionPrecompileContract = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const session = req.session as MySession;
    if (!session.contractWrappers || isEmpty(session.contractWrappers)) {
      throw new BadRequestError("There are currently no pending contracts.");
    }

    const verificationId = req.body.verificationId;
    const contractWrapper = session.contractWrappers[verificationId];

    const compilationResult = await this.verificationService.recompile(
      contractWrapper.contract
    );

    contractWrapper.contract.creationBytecode =
      compilationResult.creationBytecode;

    res.send(getSessionJSON(session));
  };

  private stringToBase64 = (str: string): string => {
    return Buffer.from(str, "utf8").toString("base64");
  };

  private sessionVerifyFromEtherscan = async (
    origReq: Request,
    res: Response
  ): Promise<void> => {
    // 1. generate metadata
    const req = origReq as MyRequest;
    this.validateRequest(req);

    const chain = req.body.chainId as string;
    const address = req.body.address;

    const processedRequest = await this.processRequestFromEtherscan(
      chain,
      address
    );
    const metadata = processedRequest.metadata;
    const solcJsonInput = processedRequest.solcJsonInput;

    // 2. save the files in the session
    const pathContents: PathContent[] = Object.keys(solcJsonInput.sources).map(
      (path) => {
        return {
          path: path,
          content: this.stringToBase64(solcJsonInput.sources[path].content),
        };
      }
    );
    pathContents.push({
      path: "metadata.json",
      content: this.stringToBase64(JSON.stringify(metadata)),
    });
    const session = req.session as MySession;
    const newFilesCount = this.saveFiles(pathContents, session);
    if (newFilesCount === 0) {
      throw new BadRequestError("The contract didn't add any new file");
    }

    // 3. create the contractwrappers from the files
    await this.validateContracts(session);
    if (!session.contractWrappers) {
      throw new BadRequestError(
        "Unknown error during the Etherscan verification process"
      );
      return;
    }

    // 4. set the chainid and address for the contract
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

    // 5. verify
    await this.verifyValidated(verifiable, session);
    res.send(getSessionJSON(session));
  };

  private legacyVerifyEndpoint = async (
    origReq: Request,
    res: Response
  ): Promise<any> => {
    const req = origReq as MyRequest;
    this.validateRequest(req);

    for (const address of req.addresses) {
      const result = this.verificationService.findByAddress(address, req.chain);
      if (result.length != 0) {
        return res.send({ result });
      }
    }

    const inputFiles = this.extractFiles(req);
    if (!inputFiles) {
      const msg =
        "The contract at the provided address and chain has not yet been sourcified.";
      throw new NotFoundError(msg);
    }

    let validatedContracts: CheckedContract[];
    try {
      validatedContracts = await this.validationService.checkFiles(inputFiles);
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }

    const errors = validatedContracts
      .filter((contract) => !CheckedContract.isValid(contract, true))
      .map(this.stringifyInvalidAndMissing);
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

    const injectorInput: InjectorInput = {
      contract,
      addresses: req.addresses,
      chain: req.chain,
    };
    try {
      const result = await this.verificationService.inject(injectorInput);
      // Send to verification again with all source files.
      if (result.status === "extra-file-input-bug") {
        const contractWithAllSources =
          await this.validationService.useAllSources(contract, inputFiles);
        const tempResult = await this.verificationService.inject({
          ...injectorInput,
          contract: contractWithAllSources,
        });
        if (tempResult.status === "perfect") {
          res.send({ result: [tempResult] });
        }
      }
      res.send({ result: [result] }); // array is an old expected behavior (e.g. by frontend)
    } catch (error: any) {
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .send({ error: error.message });
    }
  };

  private checkAllByAddresses = async (req: any, res: Response) => {
    this.validateRequest(req);
    const map: Map<string, any> = new Map();
    for (const address of req.addresses) {
      for (const chainId of req.chainIds) {
        try {
          const found: Match[] = this.verificationService.findAllByAddress(
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

  private checkByAddresses = async (req: any, res: Response) => {
    this.validateRequest(req);
    const map: Map<string, any> = new Map();
    for (const address of req.addresses) {
      for (const chainId of req.chainIds) {
        try {
          const found: Match[] = this.verificationService.findByAddress(
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

  private validateContracts = async (session: MySession) => {
    const pathBuffers: PathBuffer[] = [];
    for (const id in session.inputFiles) {
      const pathContent = session.inputFiles[id];
      pathBuffers.push({
        path: pathContent.path,
        buffer: Buffer.from(pathContent.content, FILE_ENCODING),
      });
    }

    try {
      const unused: string[] = [];
      const contracts = await this.validationService.checkFiles(
        pathBuffers,
        unused
      );

      const newPendingContracts: ContractWrapperMap = {};
      for (const contract of contracts) {
        newPendingContracts[generateId(contract.metadataRaw)] = { contract };
      }

      session.contractWrappers ||= {};
      for (const newId in newPendingContracts) {
        const newContractWrapper = newPendingContracts[newId];
        const oldContractWrapper = session.contractWrappers[newId];
        if (oldContractWrapper) {
          for (const path in newContractWrapper.contract.solidity) {
            oldContractWrapper.contract.solidity[path] =
              newContractWrapper.contract.solidity[path];
            delete oldContractWrapper.contract.missing[path];
          }
          oldContractWrapper.contract.solidity =
            newContractWrapper.contract.solidity;
          oldContractWrapper.contract.missing =
            newContractWrapper.contract.missing;
        } else {
          session.contractWrappers[newId] = newContractWrapper;
        }
      }
      updateUnused(unused, session);
    } catch (error) {
      const paths = pathBuffers.map((pb) => pb.path);
      updateUnused(paths, session);
    }
  };

  private verifyValidatedEndpoint = async (req: Request, res: Response) => {
    const session = req.session as MySession;
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
        if (isVerifiable(contractWrapper)) {
          verifiable[id] = contractWrapper;
        }
      }
    }

    await this.verifyValidated(verifiable, session);
    res.send(getSessionJSON(session));
  };

  private async verifyValidated(
    contractWrappers: ContractWrapperMap,
    session: MySession
  ): Promise<void> {
    for (const id in contractWrappers) {
      const contractWrapper = contractWrappers[id];

      await this.checkAndFetchMissing(contractWrapper.contract);

      if (!isVerifiable(contractWrapper)) {
        continue;
      }
      const injectorInput: InjectorInput = {
        addresses: [contractWrapper.address as string],
        chain: contractWrapper.chainId as string,
        contract: contractWrapper.contract,
      };

      const found = this.verificationService.findByAddress(
        contractWrapper.address as string,
        contractWrapper.chainId as string
      );
      let match: Match;
      if (found.length) {
        match = found[0];
      } else {
        try {
          match = await this.verificationService.inject(injectorInput);
          // Send to verification again with all source files.
          if (match.status === "extra-file-input-bug") {
            // Session inputFiles are encoded base64. Why?
            const pathBufferInputFiles: PathBuffer[] = Object.values(
              session.inputFiles
            ).map((base64file) => ({
              path: base64file.path,
              buffer: Buffer.from(base64file.content, FILE_ENCODING),
            }));
            const contractWithAllSources =
              await this.validationService.useAllSources(
                contractWrapper.contract,
                pathBufferInputFiles
              );
            const tempMatch = await this.verificationService.inject({
              ...injectorInput,
              contract: contractWithAllSources,
            });
            if (
              tempMatch.status === "perfect" ||
              tempMatch.status === "partial"
            ) {
              match = tempMatch;
            }
          }
        } catch (error: any) {
          match = {
            chainId: contractWrapper.chainId as string,
            status: null,
            address: contractWrapper.address as string,
            message: error.message,
          };
        }
      }
      contractWrapper.status = match.status || "error";
      contractWrapper.statusMessage = match.message;
      contractWrapper.storageTimestamp = match.storageTimestamp;
    }
  }

  private async checkAndFetchMissing(contract: CheckedContract): Promise<void> {
    if (!CheckedContract.isValid(contract)) {
      try {
        // Try to fetch missing files
        await CheckedContract.fetchMissing(contract);
      } catch (e) {
        // Missing files are accessible from the contract.missingFiles array.
        // No need to throw an error
      }
    }
  }

  private extractFiles = (req: Request, shouldThrow = false) => {
    if (req.is("multipart/form-data") && req.files && req.files.files) {
      return this.extractFilesFromForm(req.files.files);
    } else if (req.is("application/json") && req.body.files) {
      return this.extractFilesFromJSON(req.body.files);
    }

    if (shouldThrow) {
      throw new ValidationError([
        { param: "files", msg: "There should be files in the <files> field" },
      ]);
    }
  };

  private extractFilesFromForm(files: any): PathBuffer[] {
    const fileArr: fileUpload.UploadedFile[] = [].concat(files); // ensure an array, regardless of how many files received
    return fileArr.map((f) => ({ path: f.name, buffer: f.data }));
  }

  private extractFilesFromJSON(files: any): PathBuffer[] {
    const inputFiles = [];
    for (const name in files) {
      const file = files[name];
      const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
      inputFiles.push({ path: name, buffer });
    }
    return inputFiles;
  }

  private saveFiles(pathContents: PathContent[], session: MySession): number {
    if (!session.inputFiles) {
      session.inputFiles = {};
    }

    let inputSize = 0; // shall contain old buffer size + new files size
    for (const id in session.inputFiles) {
      const pc = session.inputFiles[id];
      inputSize += pc.content.length;
    }

    pathContents.forEach((pc) => (inputSize += pc.content.length));

    if (inputSize > VerificationController.MAX_SESSION_SIZE) {
      const msg =
        "Too much session memory used. Delete some files or clear the session.";
      throw new PayloadTooLargeError(msg);
    }

    let newFilesCount = 0;
    pathContents.forEach((pc) => {
      const newId = generateId(pc.content);
      if (!(newId in session.inputFiles)) {
        session.inputFiles[newId] = pc;
        ++newFilesCount;
      }
    });

    return newFilesCount;
  }

  private addInputFilesEndpoint = async (req: Request, res: Response) => {
    this.validateRequest(req);
    let inputFiles: PathBuffer[] | undefined;
    if (req.query.url) {
      inputFiles = await addRemoteFile(req.query);
    } else {
      inputFiles = this.extractFiles(req, true);
    }
    if (!inputFiles)
      throw new ValidationError([{ param: "files", msg: "No files found" }]);
    const pathContents: PathContent[] = inputFiles.map((pb) => {
      return { path: pb.path, content: pb.buffer.toString(FILE_ENCODING) };
    });

    const session = req.session as MySession;
    const newFilesCount = this.saveFiles(pathContents, session);
    if (newFilesCount) {
      await this.validateContracts(session);
      await this.verifyValidated(session.contractWrappers, session);
    }
    res.send(getSessionJSON(session));
  };

  private addInputContractEndpoint = async (req: Request, res: Response) => {
    this.validateRequest(req);

    const address = req.body.address;
    const chainId = req.body.chainId;

    const bytecode = await this.verificationService.getBytecode(
      address,
      chainId
    );

    const { ipfs: metadataIpfsCid } = decode(bytecode);

    if (!metadataIpfsCid) {
      throw new BadRequestError(
        "The contract doesn't have a metadata IPFS CID"
      );
    }

    const ipfsUrl = `${IPFS_GATEWAY}${metadataIpfsCid}`;
    const metadataFileName = "metadata.json";
    const retrievedMetadataText = await performFetch(ipfsUrl);

    if (!retrievedMetadataText)
      throw new Error(`Could not retrieve metadata from ${ipfsUrl}`);
    const pathContents: PathContent[] = [];

    const retrievedMetadataBase64 = Buffer.from(retrievedMetadataText).toString(
      "base64"
    );

    pathContents.push({
      path: metadataFileName,
      content: retrievedMetadataBase64,
    });

    const session = req.session as MySession;
    const newFilesCount = this.saveFiles(pathContents, session);
    if (newFilesCount) {
      await this.validateContracts(session);
      // verifyValidated fetches missing files from the contract
      await this.verifyValidated(session.contractWrappers, session);
    }
    res.send(getSessionJSON(session));
  };

  private restartSessionEndpoint = async (req: Request, res: Response) => {
    req.session.destroy((error: Error) => {
      let msg = "";
      let statusCode = null;

      const loggerOptions: any = {
        loc: "[VERIFICATION_CONTROLER:RESTART]",
        id: req.sessionID,
      };
      if (error) {
        msg = "Error in clearing session";
        loggerOptions.err = error.message;
        statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
      } else {
        msg = "Session successfully cleared";
        statusCode = StatusCodes.OK;
      }

      res.status(statusCode).send(msg);
    });
  };

  private getSessionDataEndpoint = async (req: Request, res: Response) => {
    res.send(getSessionJSON(req.session as MySession));
  };

  private validateRequest(req: Request) {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      throw new ValidationError(result.array());
    }
  }

  private authenticatedRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const sourcifyClientTokensRaw = process.env.CREATE2_CLIENT_TOKENS;
    if (sourcifyClientTokensRaw?.length) {
      const sourcifyClientTokens = sourcifyClientTokensRaw.split(",");
      const clientToken = req.body.clientToken;
      if (!clientToken) {
        throw new BadRequestError("This API is protected by a client token");
      }
      if (!sourcifyClientTokens.includes(clientToken)) {
        throw new BadRequestError("The client token you provided is not valid");
      }
    }
    next();
  }

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
          (address, { req }) =>
            (req.addresses = this.validateAddresses(address))
        ),
      body("chain")
        .exists()
        .bail()
        .custom(
          (chain, { req }) => (req.chain = this.validateSingleChainId(chain))
        ),
      this.safeHandler(this.legacyVerifyEndpoint)
    );

    this.router.route(["/verify/etherscan"]).post(
      // TODO: add validation
      this.safeHandler(this.verifyFromEtherscan)
    );

    this.router.route(["/verify/create2"]).post(
      body("deployerAddress")
        .exists()
        .bail()
        .custom((deployerAddress, { req }) => {
          const addresses = this.validateAddresses(deployerAddress);
          req.deployerAddress = addresses.length > 0 ? addresses[0] : "";
          return true;
        }),
      body("create2Address")
        .exists()
        .bail()
        .custom((create2Address, { req }) => {
          const addresses = this.validateAddresses(create2Address);
          req.create2Address = addresses.length > 0 ? addresses[0] : "";
          return true;
        }),
      body("salt").exists(),
      body("constructorArgs").exists(),
      this.authenticatedRequest,
      this.safeHandler(this.verifyCreate2)
    );

    this.router.route(["/check-all-by-addresses", "/checkAllByAddresses"]).get(
      query("addresses")
        .exists()
        .bail()
        .custom(
          (addresses, { req }) =>
            (req.addresses = this.validateAddresses(addresses))
        ),
      query("chainIds")
        .exists()
        .bail()
        .custom(
          (chainIds, { req }) =>
            (req.chainIds = this.validateChainIds(chainIds))
        ),
      this.safeHandler(this.checkAllByAddresses)
    );

    this.router.route(["/check-by-addresses", "/checkByAddresses"]).get(
      query("addresses")
        .exists()
        .bail()
        .custom(
          (addresses, { req }) =>
            (req.addresses = this.validateAddresses(addresses))
        ),
      query("chainIds")
        .exists()
        .bail()
        .custom(
          (chainIds, { req }) =>
            (req.chainIds = this.validateChainIds(chainIds))
        ),
      this.safeHandler(this.checkByAddresses)
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

    this.router
      .route(["/session/input-contract"])
      .all(cors(corsOpt))
      .post(cors(corsOpt), this.safeHandler(this.addInputContractEndpoint));

    this.router
      .route(["/restart-session", "/session/clear"])
      .all(cors(corsOpt))
      .post(cors(corsOpt), this.safeHandler(this.restartSessionEndpoint));

    this.router
      .route(["/verify-validated", "/session/verify-validated"])
      .all(cors(corsOpt))
      .post(
        body("contracts").isArray(),
        cors(corsOpt),
        this.safeHandler(this.verifyValidatedEndpoint)
      );

    this.router
      .route(["/session/verify/etherscan"])
      .all(cors(corsOpt))
      .post(
        body("address").exists(),
        body("chainId").exists(),
        cors(corsOpt),
        this.safeHandler(this.sessionVerifyFromEtherscan)
      );

    this.router
      .route(["/session/verify/create2"])
      .all(cors(corsOpt))
      .post(
        body("deployerAddress")
          .exists()
          .bail()
          .custom((deployerAddress, { req }) => {
            const addresses = this.validateAddresses(deployerAddress);
            req.deployerAddress = addresses.length > 0 ? addresses[0] : "";
          }),
        body("create2Address")
          .exists()
          .bail()
          .custom((create2Address, { req }) => {
            const addresses = this.validateAddresses(create2Address);
            req.create2Address = addresses.length > 0 ? addresses[0] : "";
          }),
        body("salt").exists(),
        body("constructorArgs").exists(),
        body("verificationId").exists(),
        cors(corsOpt),
        this.authenticatedRequest,
        this.safeHandler(this.sessionVerifyCreate2)
      );

    this.router
      .route(["/session/verify/create2/compile"])
      .all(cors(corsOpt))
      .post(
        body("verificationId").exists(),
        cors(corsOpt),
        this.safeHandler(this.sessionPrecompileContract)
      );

    return this.router;
  };
}
