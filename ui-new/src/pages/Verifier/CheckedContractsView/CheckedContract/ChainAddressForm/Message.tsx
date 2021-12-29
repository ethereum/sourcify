import { HiExclamation } from "react-icons/hi";
import { ID_TO_CHAIN } from "../../../../../constants";
import {
  CheckAllByAddressResult,
  SendableContract,
} from "../../../../../types";
import { generateRepoLink } from "../../../../../utils/utils";

// Message displayed after each interaction inside the container
type MessageProps = {
  customStatus: string;
  checkedContract: SendableContract;
  foundMatches: CheckAllByAddressResult | undefined;
};

type RepoLinkProps = {
  chainIds: string[];
  status: "perfect" | "partial";
  address: string;
};
const RepoLinks = ({ chainIds, status, address }: RepoLinkProps) => (
  <p>
    {status === "perfect" && "Fully"}
    {status === "partial" && "Partially"} verified at{" "}
    {chainIds.map((chainId, i) => {
      return (
        <span>
          {i > 0 && ", "}
          <a
            href={generateRepoLink(chainId, address, status)}
            target="_blank"
            className="underline"
            key={`${address}-${chainId}-repo-link`}
            rel="noreferrer"
          >
            {ID_TO_CHAIN[parseInt(chainId)].label}
          </a>
        </span>
      );
    })}
  </p>
);
const Message = ({
  customStatus,
  foundMatches,
  checkedContract,
}: MessageProps) => {
  // Show success after successfull verification
  if (customStatus === "perfect" || customStatus === "partial") {
    return (
      <p>
        Verification successful! {customStatus}ly verified at{" "}
        <b>{checkedContract.chainId}</b>:{checkedContract.address}
      </p>
    );
  }
  if (customStatus === "error") {
    if (checkedContract.statusMessage) {
      return (
        <div className="bg-yellow-100 px-4 py-2 rounded-md outline-2 outline-yellow-400 outline">
          <p className="break-all">
            <HiExclamation className="text-yellow-500 inline mr-1 align-middle" />
            {checkedContract.statusMessage}
          </p>
        </div>
      );
    }
    return <p>Please provide contract address and network </p>;
  }
  // Show existing matches of the address after checkAllByAddress
  if (foundMatches?.chainIds) {
    const perfectMatchChainIds = foundMatches.chainIds
      .filter((idMatch) => idMatch.status === "perfect")
      .map((idMatch) => idMatch.chainId);
    const partialMatchChainIds = foundMatches.chainIds
      .filter((idMatch) => idMatch.status === "partial")
      .map((idMatch) => idMatch.chainId);
    return (
      <div>
        <p>Contract {foundMatches.address} is already verified:</p>
        {perfectMatchChainIds.length > 0 && (
          <RepoLinks
            chainIds={perfectMatchChainIds}
            status="perfect"
            address={foundMatches.address}
          />
        )}
        {partialMatchChainIds.length > 0 && (
          <RepoLinks
            chainIds={perfectMatchChainIds}
            status="partial"
            address={foundMatches.address}
          />
        )}
      </div>
    );
  }
  return null;
};

export default Message;
