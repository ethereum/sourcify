import { SourcifyChain } from "@ethereum-sourcify/lib-sourcify";
import { StatusCodes } from "http-status-codes";
import fetch from "node-fetch";
import puppeteer from "puppeteer";

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
  const contractFetchAddressFilled =
    sourcifyChain.contractFetchAddress?.replace("${ADDRESS}", address);
  const txRegex = sourcifyChain?.txRegex;

  if (!contractFetchAddressFilled) return null;

  // Chains with the new Etherscan API that returns the creation transaction hash
  if (contractFetchAddressFilled.includes("action=getcontractcreation")) {
    const response = await fetchFromApi(contractFetchAddressFilled);
    if (response?.result?.[0]?.txHash)
      return response?.result?.[0]?.txHash as string;
  }

  // If there's txRegex, scrape block explorers
  if (contractFetchAddressFilled && txRegex) {
    const creatorTx = await getCreatorTxByScraping(
      contractFetchAddressFilled,
      txRegex
    );
    if (creatorTx) return creatorTx;
  }

  // Telos
  if (sourcifyChain.chainId == 40 || sourcifyChain.chainId == 41) {
    const response = await fetchFromApi(contractFetchAddressFilled);
    if (response.creation_trx) return response.creation_trx as string;
  }

  // XDC
  if (sourcifyChain.chainId == 50 || sourcifyChain.chainId == 51) {
    const response = await fetchFromApi(contractFetchAddressFilled);
    if (response.fromTxn) return response.fromTxn as string;
  }

  // Meter network
  if (sourcifyChain.chainId == 83 || sourcifyChain.chainId == 82) {
    const response = await fetchFromApi(contractFetchAddressFilled);
    if (response?.account?.creationTxHash)
      return response.account.creationTxHash as string;
  }

  // Avalanche Subnets
  if ([11111, 335, 53935, 432201, 432204].includes(sourcifyChain.chainId)) {
    const response = await fetchFromApi(contractFetchAddressFilled);
    if (response.nativeTransaction?.txHash)
      return response.nativeTransaction.txHash as string;
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
  txRegex: string[]
): Promise<string | null> {
  const browser = await puppeteer.launch({ headless: "new" });
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
  }
  if (response.status() === StatusCodes.FORBIDDEN) {
    throw new Error(
      `Scraping the creator tx failed at ${fetchAddress} because of HTTP status code ${response.status()} (Forbidden)
      
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
