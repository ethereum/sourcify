import { SERVER_URL } from "../constants";
import { CheckAllByAddressResult } from "../types";

type ChainIdsResponse = {
  chainId: string,
  status: string
}

export type ServersideAddressCheck = {
  address: string,
  status: string,
  chainIds?: ChainIdsResponse[]
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
  ).then((res) => res.json());

  return response;
};
