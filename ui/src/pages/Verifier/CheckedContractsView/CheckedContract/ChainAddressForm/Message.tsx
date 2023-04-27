import { useContext } from "react";
import { HiCheck, HiExclamation } from "react-icons/hi";
import { Context } from "../../../../../Context";
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
  overrideLabel?: string;
};
const RepoLinks = ({
  chainIds,
  status,
  address,
  overrideLabel,
}: RepoLinkProps) => {
  const { sourcifyChainMap } = useContext(Context);

  return (
    <p>
      {status === "perfect" && !overrideLabel && (
        <>
          <b>Fully verified</b> at{" "}
        </>
      )}
      {status === "partial" && !overrideLabel && (
        <>
          <b>Partially verified</b> at{" "}
        </>
      )}
      {chainIds.map((chainId, i) => {
        return (
          <span>
            {i > 0 && ", "}
            <a
              href={generateRepoLink(chainId, address, status)}
              className="underline"
              key={`${address}-${chainId}-repo-link`}
            >
              {overrideLabel ||
                sourcifyChainMap[parseInt(chainId)].title ||
                sourcifyChainMap[parseInt(chainId)].name}{" "}
              (#{chainId})
            </a>
          </span>
        );
      })}
    </p>
  );
};
const Message = ({
  customStatus,
  foundMatches,
  checkedContract,
}: MessageProps) => {
  const { sourcifyChainMap } = useContext(Context);
  const chain = sourcifyChainMap[parseInt(checkedContract.chainId as string)];
  const bgColor =
    customStatus === "perfect" ? "bg-green-100" : "bg-partialMatch-100";
  const outlineColor =
    customStatus === "perfect"
      ? "outline-green-400"
      : "outline-partialMatch-400";
  const textColor =
    customStatus === "perfect" ? "text-green-500" : "text-partialMatch-500";
  const darkTextColor =
    customStatus === "perfect" ? "text-green-700" : "text-partialMatch-700";
  // Show success after successfull verification
  if (chain && (customStatus === "perfect" || customStatus === "partial")) {
    return (
      <div
        className={`${bgColor} px-4 py-2 rounded-md outline-2 ${outlineColor} outline`}
      >
        <p className="break-all">
          <HiCheck className={`${textColor} inline mr-1 align-middle`} />
          Verification successful!{" "}
          <span className={`${darkTextColor} font-bold`}>
            {customStatus}ly
          </span>{" "}
          verified at <b>{chain.title || chain.name}</b>:
          {checkedContract.address}
          {checkedContract?.address && (
            <RepoLinks
              chainIds={[chain.chainId.toString()]}
              status={customStatus}
              overrideLabel="View in repository"
              address={checkedContract.address}
            />
          )}
        </p>
      </div>
    );
  }
  if (
    checkedContract.chainId === "0" &&
    (customStatus === "perfect" || customStatus === "partial")
  ) {
    return (
      <div
        className={`${bgColor} px-4 py-2 rounded-md outline-2 ${outlineColor} outline`}
      >
        <p className="break-all">
          <HiCheck className={`${textColor} inline mr-1 align-middle`} />
          Verification successful!{" "}
          <span className={`${darkTextColor} font-bold`}>
            {customStatus}ly
          </span>{" "}
          create2 verified:
          {checkedContract.address}
        </p>
      </div>
    );
  }
  if (customStatus === "error") {
    if (checkedContract.statusMessage) {
      console.log(checkedContract.statusMessage);
      return (
        <div className="bg-yellow-100 px-4 py-2 rounded-md outline-2 outline-yellow-400 outline">
          <p className="break-all whitespace-pre-wrap">
            <HiExclamation className="text-yellow-500 inline mr-1 align-middle" />
            {checkedContract.statusMessage}
          </p>
        </div>
      );
    }
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
      <div
        className={`bg-ceruleanBlue-200 px-4 py-2 rounded-md outline-2 outline-ceruleanBlue-300 outline text-ceruleanBlue-800`}
      >
        <p className="break-all">
          Contract <b>{foundMatches.address}</b> is already verified:
        </p>
        {perfectMatchChainIds.length > 0 && (
          <RepoLinks
            chainIds={perfectMatchChainIds}
            status="perfect"
            address={foundMatches.address}
          />
        )}
        {partialMatchChainIds.length > 0 && (
          <RepoLinks
            chainIds={partialMatchChainIds}
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
