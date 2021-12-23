import { SERVER_URL } from "../constants";
import { CheckAllByAddressResult } from "../types";

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
