import { Response, Request, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import {
  ContractData,
  FilesInfo,
  MatchLevel,
  MatchLevelWithoutAny,
  PaginatedContractData,
} from "../../types";
import { NotFoundError } from "../../../common/errors";
import { Match } from "@ethereum-sourcify/lib-sourcify";
import logger from "../../../common/logger";
import { Services } from "../../services/services";
import {
  ProxyContractResolver,
  ProxyType,
} from "../../services/utils/proxy-contract-util";
import { ChainRepository } from "../../../sourcify-chain-repository";

type RetrieveMethod = (
  services: Services,
  chain: string,
  address: string,
  match: MatchLevel,
) => Promise<FilesInfo<any>>;
type ConractRetrieveMethod = (
  services: Services,
  chain: string,
) => Promise<ContractData>;
type PaginatedConractRetrieveMethod = (
  services: Services,
  chain: string,
  match: MatchLevel,
  page: number,
  limit: number,
  descending: boolean,
) => Promise<PaginatedContractData>;

export function createEndpoint(
  retrieveMethod: RetrieveMethod,
  match: MatchLevel,
  reportMatchStatus = false,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const services = req.app.get("services") as Services;
    let retrieved: FilesInfo<any>;
    try {
      retrieved = await retrieveMethod(
        services,
        req.params.chain,
        req.params.address,
        match,
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
  contractRetrieveMethod: ConractRetrieveMethod,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const services = req.app.get("services") as Services;
    let retrieved: ContractData;
    try {
      retrieved = await contractRetrieveMethod(services, req.params.chain);
      if (retrieved.full.length === 0 && retrieved.partial.length === 0)
        return next(new NotFoundError("Contracts have not been found!"));
    } catch (err: any) {
      return next(new NotFoundError(err.message));
    }
    return res.status(StatusCodes.OK).json(retrieved);
  };
}

export function createPaginatedContractEndpoint(
  paginatedContractRetrieveMethod: PaginatedConractRetrieveMethod,
  match: MatchLevel,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const services = req.app.get("services") as Services;
    let retrieved: PaginatedContractData;
    try {
      retrieved = await paginatedContractRetrieveMethod(
        services,
        req.params.chain,
        match,
        parseInt((req.query.page as string) || "0"),
        parseInt((req.query.limit as string) || "200"),
        req.query.order === "desc", // default is asc
      );
    } catch (err: any) {
      return next(new NotFoundError(err.message));
    }
    return res.status(StatusCodes.OK).json(retrieved);
  };
}

export interface CheckAllByChainAndAddressEndpointRequest extends Request {
  query: {
    addresses: string;
    chainIds: string;
  };
}

export async function checkAllByChainAndAddressEndpoint(
  req: CheckAllByChainAndAddressEndpointRequest,
  res: Response,
) {
  const services = req.app.get("services") as Services;
  const chainRepository = req.app.get("chainRepository") as ChainRepository;
  const map: Map<string, any> = new Map();
  const addresses = req.query.addresses.split(",");
  const chainIds = req.query.chainIds?.split?.(",");
  logger.debug("checkAllByChainAndAddresses", { chainIds, addresses });
  for (const address of addresses) {
    for (const chainId of chainIds) {
      try {
        const found: Match[] = await services.storage.performServiceOperation(
          "checkAllByChainAndAddress",
          [address, chainId],
        );
        if (found.length != 0) {
          if (!map.has(address)) {
            map.set(address, {
              address,
              chainIds: [],
            });
          }

          // Proxy detection and resolution
          const proxyStatus: {
            isProxy?: boolean;
            proxyType?: ProxyType;
            implementationAddresses?: string[];
          } = {};
          if (found[0].onchainRuntimeBytecode) {
            const proxyResolver = new ProxyContractResolver(
              found[0].onchainRuntimeBytecode,
              address,
            );
            const proxyType = await proxyResolver.detectProxy();
            proxyStatus.isProxy = proxyType !== null;
            if (proxyType) {
              proxyStatus.proxyType = proxyType;

              const sourcifyChain = chainRepository.supportedChainMap[chainId];
              const implementationAddresses =
                await proxyResolver.resolve(sourcifyChain);

              type Implementation = { address: string; name?: string };
              const implementations: Implementation[] = [];
              for (const implementationAddress of implementationAddresses) {
                const implementation: Implementation = {
                  address: implementationAddress,
                };

                const implementationFound: Match[] =
                  await services.storage.performServiceOperation(
                    "checkAllByChainAndAddress",
                    [implementationAddress, chainId],
                  );
                if (
                  implementationFound.length > 0 &&
                  implementationFound[0].contractName
                ) {
                  implementation.name = implementationFound[0].contractName;
                }

                implementations.push(implementation);
              }
            }
          }

          map.get(address).chainIds.push({
            chainId,
            status: found[0].runtimeMatch,
            ...proxyStatus,
          });
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
  logger.debug("Result checkAllByChainAndAddresses", { resultArray });
  res.send(resultArray);
}

function jsonOrString(str: string): object | string {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

export async function getFileEndpoint(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { match, chain, address } = req.params;
  const services = req.app.get("services") as Services;
  const file = await services.storage.performServiceOperation("getFile", [
    chain,
    address,
    match as MatchLevelWithoutAny,
    req.params[0],
  ]);
  if (file === false) {
    return next(new NotFoundError());
  }
  res.send(jsonOrString(file));
}

export async function checkByChainAndAddressesEnpoint(
  req: Request,
  res: Response,
) {
  const services = req.app.get("services") as Services;
  const map: Map<string, any> = new Map();
  const addresses = (req.query.addresses as string).split(",");
  const chainIds = (req.query.chainIds as string).split(",");
  logger.debug("checkByChainAndAddresses", { chainIds, addresses });
  for (const address of addresses) {
    for (const chainId of chainIds) {
      try {
        const found: Match[] = await services.storage.performServiceOperation(
          "checkByChainAndAddress",
          [address, chainId],
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
  logger.debug("Result checkByChainAndAddresses", { resultArray });
  res.send(resultArray);
}
