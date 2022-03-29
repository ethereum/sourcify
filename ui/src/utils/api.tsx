import { SERVER_URL } from "../constants";
import { Chain, CheckAllByAddressResult } from "../types";

type ChainIdsResponse = {
  chainId: string;
  status: string;
};

export type ServersideAddressCheck = {
  address: string;
  status: string;
  chainIds?: ChainIdsResponse[];
};

export const checkAllByAddresses = async (
  addresses: string,
  chainIds: string
): Promise<CheckAllByAddressResult[]> => {
  const response = await fetch(
    `${SERVER_URL}/checkAllByAddresses?addresses=${addresses}&chainIds=${chainIds}`,
    {
      method: "GET",
    }
  ).then((res) => {
    if (!res.ok) {
      // e.g. HTTP 400 invalid address
      return res.json().then((json) => {
        throw new Error(json.message);
      });
    }
    return res.json();
  });

  return response;
};

/**
 * @function to fetch Sourcify's chains array and return as an object with the chainId as keys.
 *
 * The Ethereum networks are placed on top, the rest of the networks are sorted alphabetically.
 *
 */
export const getSourcifyChains = async (): Promise<Chain[]> => {
  const chainsArray = await (await fetch(`${SERVER_URL}/chains`)).json();
  return chainsArray;
};
