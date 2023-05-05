import { useContext } from "react";
import { renderToString } from "react-dom/server";
import {
  HiBadgeCheck,
  HiOutlineArrowLeft,
  HiOutlineInformationCircle,
  HiX,
} from "react-icons/hi";
import { Link } from "react-router-dom";
import ReactTooltip from "react-tooltip";
import Button from "../../components/Button";
import {
  REPOSITORY_SERVER_URL_FULL_MATCH,
  REPOSITORY_SERVER_URL_PARTIAL_MATCH,
} from "../../constants";
import { Context } from "../../Context";
import { CheckAllByAddressResult } from "../../types";
import { isBrowser } from "react-device-detect";

type ResultProp = {
  response: CheckAllByAddressResult;
  goBack: React.DispatchWithoutAction;
};

const URL_TYPE = {
  REMIX: "remix",
  REPO: "repo",
};

const generateUrl = (
  type: string,
  chainId: string,
  address: string,
  status: string
) => {
  const REPO_URL =
    status === "partial"
      ? REPOSITORY_SERVER_URL_PARTIAL_MATCH
      : REPOSITORY_SERVER_URL_FULL_MATCH;
  if (type === URL_TYPE.REMIX)
    return `https://remix.ethereum.org/?#activate=sourcify&call=sourcify//fetchAndSave//${address}//${chainId}`;
  return `${REPO_URL}/${chainId}/${address}/`;
};

type NetworkRowProp = {
  chainId: string;
  status: string;
  address: any;
};
type FoundProp = {
  response: CheckAllByAddressResult;
  goBack: () => void;
};
type NotFoundProp = {
  address: any;
  goBack: () => void;
};

type MatchStatusProps = {
  status: string;
};
const PerfectMatchInfoText = (
  <span>
    A perfect match indicates the Solidity source code does not deviate a single
    byte from the source code when deployed. <br /> See{" "}
    <a
      href="https://docs.sourcify.dev/docs/full-vs-partial-match"
      className="underline cursor"
    >
      docs
    </a>{" "}
    for details.
  </span>
);
const PartialMatchInfoText = (
  <span>
    A partial match indicates the Solidity source code functionally corresponds
    to the deployed contract but some aspects of the source code might differ
    from the original source code. <br /> See{" "}
    <a
      href="https://docs.sourcify.dev/docs/full-vs-partial-match"
      className="underline cursor"
    >
      docs
    </a>{" "}
    for details.
  </span>
);
const MatchStatusBadge = ({ status }: MatchStatusProps) => {
  if (status === "perfect") {
    return (
      <>
        <ReactTooltip
          effect="solid"
          delayHide={500}
          clickable={true}
          className="max-w-xl"
          id="perfect-info"
        />
        <span
          className="text-sm px-3 ml-1 py-1.5 capitalize bg-green-600 text-white font-medium rounded-full"
          data-tip={renderToString(PerfectMatchInfoText)}
          data-html={true}
          data-for="perfect-info"
        >
          {status} match
        </span>
      </>
    );
  }
  if (status === "partial") {
    return (
      <>
        <ReactTooltip
          effect="solid"
          delayHide={500}
          clickable={true}
          className="max-w-xl"
          id="partial-info"
        />
        <span
          className="text-sm px-3 ml-1 py-1.5 capitalize bg-partialMatch-500 text-white font-medium rounded-full"
          data-tip={renderToString(PartialMatchInfoText)}
          data-html={true}
          data-for="partial-info"
        >
          {status} match
        </span>
      </>
    );
  }
  return null;
};
const NetworkRow = ({ address, chainId, status }: NetworkRowProp) => {
  const { sourcifyChainMap } = useContext(Context);

  const chainToName = (chainId: any) => {
    return sourcifyChainMap[chainId]?.title || sourcifyChainMap[chainId]?.name;
  };

  return (
    <>
      {isBrowser ? (
        <tr className="border-b hover:bg-gray-100">
          <td className="flex items-center py-4  pl-4">
            <span className="text-lg font-bold">{chainToName(chainId)}</span>{" "}
          </td>
          <td>
            <MatchStatusBadge status={status} />
          </td>
          <td className="py-4 text-right">
            <a
              className="underline"
              href={generateUrl(URL_TYPE.REPO, chainId, address, status)}
            >
              View in Sourcify Repository
            </a>
          </td>
          <td className="py-4 pr-4 text-right">
            <a
              className="underline"
              href={generateUrl(URL_TYPE.REMIX, chainId, address, status)}
            >
              View in Remix
            </a>
          </td>
        </tr>
      ) : (
        <div className="border-b hover:bg-gray-100 flex flex-col">
          <div className="py-4">
            <span className="text-lg font-bold">{chainToName(chainId)}</span>{" "}
          </div>
          <div>
            <MatchStatusBadge status={status} />
          </div>
          <div className="py-4">
            <a
              className="underline"
              href={generateUrl(URL_TYPE.REPO, chainId, address, status)}
            >
              View in Sourcify Repository
            </a>
          </div>
          <div className="pb-4">
            <a
              className="underline"
              href={generateUrl(URL_TYPE.REMIX, chainId, address, status)}
            >
              View in Remix
            </a>
          </div>
        </div>
      )}
    </>
  );
};

const InfoText = (isCreate2Verified: boolean) => (
  <span>
    Sourcify verification means a matching Solidity source code of the <br />{" "}
    contract is available on the Sourcify repo. <br /> See{" "}
    <a
      href="https://docs.sourcify.dev/docs/full-vs-partial-match"
      className="underline cursor"
    >
      docs
    </a>{" "}
    for details.
    {isCreate2Verified && (
      <p className="mt-3">
        This contract was verified with the{" "}
        <a
          href="https://docs.sourcify.dev/docs/create2"
          className="underline cursor"
        >
          create2 verification
        </a>
        , it may not yet be deployed.
      </p>
    )}
  </span>
);

const Create2Info = (response: CheckAllByAddressResult) => {
  const isCreate2Verified =
    response?.chainIds.findIndex((chain) => chain.chainId === "0") >= 0;
  let deployerAddress: string | undefined;
  let salt: string | undefined;
  let constructorArgs: any[] | undefined;
  if (isCreate2Verified) {
    deployerAddress = response?.create2Args?.deployerAddress;
    salt = response?.create2Args?.salt;
    constructorArgs = response?.create2Args?.constructorArgs;
  }
  return (
    <div className="mt-4 mb-4">
      <div className="flex flex-col w-full">
        <div className="flex flex-row gap-5">
          <div className="w-2/5 text-right">
            <div>Deployer:</div>
          </div>
          <div className="w-3/5 text-left break-all">{deployerAddress}</div>
        </div>
        <div className="flex flex-row gap-5">
          <div className="w-2/5 text-right">
            <div>Salt:</div>
          </div>
          <div className="w-3/5 text-left">
            <div className="break-all">{salt}</div>
          </div>
        </div>
        <div className="flex flex-row gap-5">
          <div className="w-2/5 text-right">
            <div>Constructor:</div>
          </div>
          <div className="w-3/5 text-left">
            <div className="break-all">
              <ul>
                {constructorArgs?.map((ca, i) => (
                  <li key={`constructorArgs_${i}`}>
                    {ca.value} ({ca.type})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Found = ({ response, goBack }: FoundProp) => {
  const chains = response?.chainIds.filter((chain) => chain.chainId !== "0");
  const isCreate2Verified =
    response?.chainIds.findIndex((chain) => chain.chainId === "0") >= 0;
  return (
    <div className="flex flex-col justify-center">
      <ReactTooltip
        effect="solid"
        delayHide={500}
        clickable={true}
        className="max-w-xl"
        id="verified-info"
      />
      <div className="sm:mx-20 mt-1 ">
        <p>
          The contract at address{" "}
          <span className="font-medium break-all">{response?.address}</span> is{" "}
          <span
            data-tip={renderToString(InfoText(isCreate2Verified))}
            data-html={true}
            data-for="verified-info"
          >
            {isCreate2Verified && <>create2</>} verified
            <HiOutlineInformationCircle className="inline text-gray-600 text-lg" />
          </span>
          {isCreate2Verified && (
            <>
              ,{" "}
              <a
                className="underline"
                href={generateUrl(
                  URL_TYPE.REPO,
                  "0",
                  response?.address,
                  "perfect"
                )}
              >
                view in Sourcify Repository
              </a>
            </>
          )}
        </p>
        {isCreate2Verified && Create2Info(response)}
        <p>{chains.length > 0 && <span>on the following networks:</span>}</p>
      </div>
      {chains.length > 0 ? (
        <table className="mt-12 mx-4 border-t">
          {chains.map(({ chainId, status }) => (
            <NetworkRow
              address={response?.address}
              chainId={chainId}
              status={status}
              key={chainId}
            />
          ))}
        </table>
      ) : (
        <div className="sm:mx-20 mt-1">
          This contract has not yet been deployed on any chain
        </div>
      )}
      <div className="mt-14">
        <p>Not verified on the chain you are looking for?</p>
        <Link to="/verifier">
          <Button className="mt-4 uppercase">Verify Contract</Button>
        </Link>
        <Button type="secondary" className="ml-4 uppercase" onClick={goBack}>
          Lookup Another
        </Button>
      </div>
    </div>
  );
};

const NotFound = ({ address, goBack }: NotFoundProp) => {
  return (
    <>
      <div className="sm:mx-20 mt-6">
        <p>
          The contract at address <span className="font-medium">{address}</span>{" "}
          is not verified on Sourcify.
        </p>
      </div>
      <div className="mt-14">
        <p>Do you have the source code and metadata?</p>
        <Link to="/verifier">
          <Button className="mt-4 uppercase">Verify Contract</Button>
        </Link>
        <Button type="secondary" className="ml-4 uppercase" onClick={goBack}>
          Lookup Another
        </Button>
      </div>
    </>
  );
};

const verificationIcon = (status: string | undefined) => {
  if (status === "false") {
    return <HiX className="text-8xl text-red-600" />;
  }
  return <HiBadgeCheck className="text-8xl text-green-600" />;
};

const Result = ({ response, goBack }: ResultProp) => {
  return (
    <div className="flex flex-col basis-0 py-8 flex-grow rounded-lg px-8 transition-all ease-in-out duration-300 bg-white overflow-hidden shadow-md">
      <HiOutlineArrowLeft
        className="h-8 w-8 cursor-pointer"
        onClick={() => goBack()}
      />
      <div className="flex flex-col items-center text-center">
        {verificationIcon(response?.status)}
        {!!response && response?.status !== "false" ? (
          <Found response={response} goBack={goBack} />
        ) : (
          <NotFound address={response?.address} goBack={goBack} />
        )}
      </div>
    </div>
  );
};

export default Result;
