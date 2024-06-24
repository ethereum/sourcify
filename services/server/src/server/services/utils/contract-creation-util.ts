import {
  ContractCreationFetcher,
  SourcifyChain,
} from "@ethereum-sourcify/lib-sourcify";
import { StatusCodes } from "http-status-codes";
import logger from "../../../common/logger";

const ETHERSCAN_REGEX = ["at txn.*href=.*/tx/(0x.{64})"]; // save as string to be able to return the txRegex in /chains response. If stored as RegExp returns {}
const ETHERSCAN_SUFFIX = "address/${ADDRESS}";
const BLOCKSCOUT_REGEX_OLD =
  'transaction_hash_link" href="${BLOCKSCOUT_PREFIX}/tx/(.*?)"';
const BLOCKSCOUT_REGEX_NEW = "at txn.*href.*/tx/(0x.{64}?)";
const BLOCKSCOUT_SUFFIX = "address/${ADDRESS}/transactions";
const ETHERSCAN_API_SUFFIX = `/api?module=contract&action=getcontractcreation&contractaddresses=\${ADDRESS}&apikey=`;
const BLOCKSSCAN_SUFFIX = "api/accounts/${ADDRESS}";
const BLOCKSCOUT_API_SUFFIX = "/api/v2/addresses/${ADDRESS}";
const TELOS_SUFFIX = "v1/contract/${ADDRESS}";
const METER_SUFFIX = "api/accounts/${ADDRESS}";
const AVALANCHE_SUBNET_SUFFIX =
  "contracts/${ADDRESS}/transactions:getDeployment";

function getApiContractCreationFetcher(
  url: string,
  responseParser: Function,
): ContractCreationFetcher {
  return {
    type: "api",
    url,
    responseParser,
  };
}

function getScrapeContractCreationFetcher(
  url: string,
  scrapeRegex: string[],
): ContractCreationFetcher {
  return {
    type: "scrape",
    url,
    scrapeRegex,
  };
}

function getEtherscanScrapeContractCreatorFetcher(
  apiURL: string,
): ContractCreationFetcher {
  return getScrapeContractCreationFetcher(
    apiURL + ETHERSCAN_SUFFIX,
    ETHERSCAN_REGEX,
  );
}

function getBlockscoutRegex(blockscoutPrefix = "") {
  const tempBlockscoutOld = BLOCKSCOUT_REGEX_OLD.replace(
    "${BLOCKSCOUT_PREFIX}",
    blockscoutPrefix,
  );
  return [tempBlockscoutOld, BLOCKSCOUT_REGEX_NEW];
}

function getBlockscoutScrapeContractCreatorFetcher(
  apiURL: string,
  blockscoutPrefix = "",
): ContractCreationFetcher {
  return getScrapeContractCreationFetcher(
    apiURL + BLOCKSCOUT_SUFFIX,
    getBlockscoutRegex(blockscoutPrefix),
  );
}

// api?module=contract&action=getcontractcreation&contractaddresses=\${ADDRESS}&apikey=
// For chains with the new Etherscan api that has contract creator tx hash endpoint
function getEtherscanApiContractCreatorFetcher(
  apiURL: string,
  apiKey: string,
): ContractCreationFetcher {
  return getApiContractCreationFetcher(
    apiURL + ETHERSCAN_API_SUFFIX + apiKey,
    (response: any) => {
      if (response?.result?.[0]?.txHash)
        return response?.result?.[0]?.txHash as string;
    },
  );
}

function getBlockscoutApiContractCreatorFetcher(
  apiURL: string,
): ContractCreationFetcher {
  return getApiContractCreationFetcher(
    apiURL + BLOCKSCOUT_API_SUFFIX,
    (response: any) => response?.creation_tx_hash,
  );
}

function getBlocksScanApiContractCreatorFetcher(
  apiURL: string,
): ContractCreationFetcher {
  return getApiContractCreationFetcher(
    apiURL + BLOCKSSCAN_SUFFIX,
    (response: any) => {
      if (response.fromTxn) return response.fromTxn as string;
    },
  );
}

function getMeterApiContractCreatorFetcher(
  apiURL: string,
): ContractCreationFetcher {
  return getApiContractCreationFetcher(
    apiURL + METER_SUFFIX,
    (response: any) => {
      return response.account.creationTxHash as string;
    },
  );
}

function getTelosApiContractCreatorFetcher(
  apiURL: string,
): ContractCreationFetcher {
  return getApiContractCreationFetcher(
    apiURL + TELOS_SUFFIX,
    (response: any) => {
      if (response?.results?.[0]?.transaction)
        return response.results[0].transaction as string;
    },
  );
}

function getAvalancheApiContractCreatorFetcher(
  chainId: string,
): ContractCreationFetcher {
  return getApiContractCreationFetcher(
    `https://glacier-api.avax.network/v1/chains/${chainId}/${AVALANCHE_SUBNET_SUFFIX}`,
    (response: any) => {
      if (response.nativeTransaction?.txHash)
        return response.nativeTransaction.txHash as string;
    },
  );
}

async function getCreatorTxUsingFetcher(
  fetcher: ContractCreationFetcher,
  contractAddress: string,
) {
  if (fetcher === undefined) {
    return null;
  }

  const contractFetchAddressFilled = fetcher?.url.replace(
    "${ADDRESS}",
    contractAddress,
  );

  logger.debug("Fetching Creator Tx", {
    fetcher,
    contractFetchAddressFilled,
    contractAddress,
  });

  if (!contractFetchAddressFilled) return null;

  try {
    switch (fetcher.type) {
      case "scrape": {
        if (fetcher?.scrapeRegex) {
          const creatorTx = await getCreatorTxByScraping(
            contractFetchAddressFilled,
            fetcher?.scrapeRegex,
          );
          if (creatorTx) {
            logger.debug("Fetched and found creator Tx", {
              fetcher,
              contractFetchAddressFilled,
              contractAddress,
              creatorTx,
            });
            return creatorTx;
          }
          logger.debug("Fetched but transaction not found", {
            fetcher,
            contractFetchAddressFilled,
            creatorTx,
          });
        }
        break;
      }
      case "api": {
        if (fetcher?.responseParser) {
          const response = await fetchFromApi(contractFetchAddressFilled);
          const creatorTx = fetcher?.responseParser(response);
          logger.debug("Fetched Creator Tx", {
            fetcher,
            contractFetchAddressFilled,
            contractAddress,
            creatorTx,
          });
          if (creatorTx) {
            return creatorTx;
          }
        }
        break;
      }
    }
  } catch (e: any) {
    logger.warn("Error while getting creation transaction", {
      error: e.message,
    });
    return null;
  }

  return null;
}

/**
 * Finds the transaction that created the contract by either scraping a block explorer or querying a provided API.
 *
 * @param sourcifyChain
 * @param address
 * @returns
 */
export const getCreatorTx = async (
  sourcifyChain: SourcifyChain,
  contractAddress: string,
): Promise<string | null> => {
  if (sourcifyChain.fetchContractCreationTxUsing?.blockscoutApi) {
    const fetcher = getBlockscoutApiContractCreatorFetcher(
      sourcifyChain.fetchContractCreationTxUsing?.blockscoutApi.url,
    );
    const result = await getCreatorTxUsingFetcher(fetcher, contractAddress);
    if (result) {
      return result;
    }
  }
  if (
    sourcifyChain.fetchContractCreationTxUsing?.etherscanApi &&
    sourcifyChain?.etherscanApi?.apiURL
  ) {
    const apiKey = process.env[sourcifyChain.etherscanApi.apiKeyEnvName || ""];
    const fetcher = getEtherscanApiContractCreatorFetcher(
      sourcifyChain.etherscanApi.apiURL,
      apiKey || "",
    );
    const result = await getCreatorTxUsingFetcher(fetcher, contractAddress);
    if (result) {
      return result;
    }
  }
  if (sourcifyChain.fetchContractCreationTxUsing?.avalancheApi) {
    const fetcher = getAvalancheApiContractCreatorFetcher(
      sourcifyChain.chainId.toString(),
    );
    const result = await getCreatorTxUsingFetcher(fetcher, contractAddress);
    if (result) {
      return result;
    }
  }

  if (sourcifyChain.fetchContractCreationTxUsing?.blockscoutScrape) {
    const fetcher = getBlockscoutScrapeContractCreatorFetcher(
      sourcifyChain.fetchContractCreationTxUsing?.blockscoutScrape.url,
    );
    const result = await getCreatorTxUsingFetcher(fetcher, contractAddress);
    if (result) {
      return result;
    }
  }
  if (sourcifyChain.fetchContractCreationTxUsing?.blocksScanApi) {
    const fetcher = getBlocksScanApiContractCreatorFetcher(
      sourcifyChain.fetchContractCreationTxUsing?.blocksScanApi.url,
    );
    const result = await getCreatorTxUsingFetcher(fetcher, contractAddress);
    if (result) {
      return result;
    }
  }
  if (sourcifyChain.fetchContractCreationTxUsing?.meterApi) {
    const fetcher = getMeterApiContractCreatorFetcher(
      sourcifyChain.fetchContractCreationTxUsing?.meterApi.url,
    );
    const result = await getCreatorTxUsingFetcher(fetcher, contractAddress);
    if (result) {
      return result;
    }
  }
  if (sourcifyChain.fetchContractCreationTxUsing?.telosApi) {
    const fetcher = getTelosApiContractCreatorFetcher(
      sourcifyChain.fetchContractCreationTxUsing?.telosApi.url,
    );
    const result = await getCreatorTxUsingFetcher(fetcher, contractAddress);
    if (result) {
      return result;
    }
  }
  if (sourcifyChain.fetchContractCreationTxUsing?.etherscanScrape) {
    const fetcher = getEtherscanScrapeContractCreatorFetcher(
      sourcifyChain.fetchContractCreationTxUsing?.etherscanScrape.url,
    );
    const result = await getCreatorTxUsingFetcher(fetcher, contractAddress);
    if (result) {
      return result;
    }
  }
  return null;
};

/**
 * Fetches the block explorer page (Etherscan, Blockscout etc.) of the contract and extracts the transaction hash that created the contract from the page with the provided regex for that explorer.
 *
 * @param fetchAddress the URL from which to fetch the page to be scrapd
 * @param txRegex regex whose first group matches the transaction hash on the page
 * @returns a promise of the tx hash that created the contract
 */
async function getCreatorTxByScraping(
  fetchAddress: string,
  txRegexs: string[],
): Promise<string | null> {
  const res = await fetch(fetchAddress);
  const arrayBuffer = await res.arrayBuffer();
  const page = Buffer.from(arrayBuffer).toString();
  if (res.status === StatusCodes.OK) {
    for (const txRegex of txRegexs) {
      const matched = page.match(txRegex);
      if (matched && matched[1]) {
        const txHash = matched[1];
        return txHash;
      } else {
        if (page.includes("captcha") || page.includes("CAPTCHA")) {
          logger.warn("Scraping the creator tx failed because of CAPTCHA", {
            fetchAddress,
          });
          throw new Error(
            `Scraping the creator tx failed because of CAPTCHA at ${fetchAddress}`,
          );
        }
      }
    }
  }
  if (res.status === StatusCodes.FORBIDDEN) {
    logger.warn("Scraping the creator tx failed", {
      fetchAddress,
      status: res.status,
    });
    throw new Error(
      `Scraping the creator tx failed at ${fetchAddress} because of HTTP status code ${res.status} (Forbidden)
      
      Try manually putting the creator tx hash in the "Creator tx hash" field.`,
    );
  }
  return null;
}

async function fetchFromApi(fetchAddress: string) {
  const res = await fetch(fetchAddress);
  if (res.status === StatusCodes.OK) {
    const response = await res.json();
    return response;
  }

  throw new Error(
    `Contract creator tx could not be fetched from ${fetchAddress} because of status code ${res.status}`,
  );
}
