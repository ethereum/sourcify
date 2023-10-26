import { SourcifyChain } from "@ethereum-sourcify/lib-sourcify";
import { StatusCodes } from "http-status-codes";
import fetch from "node-fetch";
import puppeteer from "puppeteer";
import { logger } from "../../../common/loggerLoki";

/**
 * Finds the transaction that created the contract by either scraping a block explorer or querying a provided API.
 *
 * @param sourcifyChain
 * @param address
 * @returns
 */
export const getCreatorTx = async (
  sourcifyChain: SourcifyChain,
  address: string
): Promise<string | null> => {
  if (sourcifyChain.contractCreationFetcher === undefined) {
    return null;
  }

  const contractFetchAddressFilled =
    sourcifyChain.contractCreationFetcher?.url.replace("${ADDRESS}", address);

  if (!contractFetchAddressFilled) return null;

  // Do not throw if we have any error while scraping, but log and return null
  try {
    const response = await fetchFromApi(contractFetchAddressFilled);
    return sourcifyChain.contractCreationFetcher?.responseParser(response);
  } catch (e: any) {
    logger.warn("Error while getting creation transaction: " + e.message);
    return null;
  }
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
  txRegex: string[]
): Promise<string | null> {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const response = await page.goto(fetchAddress);
  await new Promise((r) => setTimeout(r, 3000)); // Wait for 3 seconds

  const bodyHTML = await page.evaluate(() => document.body.innerHTML);
  await browser.close();

  if (!response)
    throw new Error(
      "Scraping the creator tx failed. No response from " + fetchAddress
    );

  if (response.status() === StatusCodes.OK) {
    for (const regex of txRegex) {
      const matched = bodyHTML.match(regex);
      if (matched && matched[1]) {
        const txHash = matched[1];
        return txHash;
      }
    }
    if (bodyHTML.includes("captcha") || bodyHTML.includes("CAPTCHA")) {
      throw new Error(
        "Scraping the creator tx failed because of CAPTCHA at ${fetchAddress}"
      );
    }
  } else {
    throw new Error(
      `Scraping the creator tx failed at ${fetchAddress} because of HTTP status code ${response.status()}
      
      Try manually putting the creator tx hash in the "Creator tx hash" field.`
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
    `Contract creator tx could not be fetched from ${fetchAddress} because of status code ${res.status}`
  );
}
