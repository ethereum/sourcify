import Button from "../../components/Button";
import { Link } from "react-router-dom";
import { CheckAllByAddressResult } from "../../types";
import { ID_TO_CHAIN } from "../../constants";

type ResultProp = {
  response: CheckAllByAddressResult
  setResponse: React.Dispatch<React.SetStateAction<CheckAllByAddressResult | undefined>>
}

const URL_TYPE = {
  REMIX: 'remix',
  REPO: 'repo'
}

const generateUrl = (type: string, chainId: string, address: string) => {
  if (type === URL_TYPE.REMIX) return `https://remix.ethereum.org/?#activate=sourcify&call=sourcify//fetchAndSave//${address}//${chainId}`
  return `https://repo.sourcify.dev/contracts/full_match/${chainId}/${address}/`
}

type NetworkRowProp = {
  chainId: string,
  status: string,
  address: any
}
type FoundProp = {
  response: CheckAllByAddressResult 
}
type NotFoundProp = {
  address: any
}

const chainToName = (chainId: any) => {
  return ID_TO_CHAIN[chainId]?.label
}

const NetworkRow = ({ address, chainId, status }: NetworkRowProp) => {
  return (
    <div className="flex justify-between px-6 py-1 mt-6 border-b-2 w-11/12 text-left">
      <div className="flex flex-1 items-center">
        <p className="text-sm font-bold">{chainToName(chainId)}</p> <small className="text-xs">({status})</small>
      </div>
      <a className="flex-1 text-sm underline" href={generateUrl(URL_TYPE.REPO, chainId, address)} target="_blank" rel="noreferrer">View in Repository</a>
      <a className="flex-1 text-sm underline" href={generateUrl(URL_TYPE.REMIX, chainId, address)} target="_blank" rel="noreferrer">View in Remix</a>
    </div>
  )
}

const Found = ({ response }: FoundProp) => {
  return (
    <>
      <div className="mx-20 mt-6">
        <p>
          The contract at address <span className="text-ceruleanBlue-700">{response?.address}</span> is verified
        </p>
      </div>
      {
        response?.chainIds.map((match) => (
          <NetworkRow address={response?.address} chainId={match?.chainId} status={match?.status} />
        ))
      }
      <div className="mt-14">
        <p>Can’t find the network you’re looking for?</p>
        <Link to="/verifier">
          <Button>Verify Contract</Button>
        </Link>
      </div>
    </>
  )
}

const NotFound = ({ address }: NotFoundProp) => {
  return (
    <>
      <div className="mx-20 mt-6">
        <p>
        The contract at address <span className="text-ceruleanBlue-700">{address}</span> is not verified on Sourcify.
        </p>
      </div>
      <div className="mt-14">
        <p>Do you have the source code and metadata??</p>
        <Link to="/verifier">
          <Button>Verify Contract</Button>
        </Link>
      </div>
    </>
  )
}

const verificationIcon = (status: string | undefined) => {
  if (status === 'false') {
    return (
      <svg className="h-14 w-14" viewBox="0 0 99 99" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M49.5 0C36.3718 0 23.7813 5.21517 14.4982 14.4982C5.21517 23.7813 0 36.3718 0 49.5C0 62.6282 5.21517 75.2187 14.4982 84.5018C23.7813 93.7848 36.3718 99 49.5 99C62.6282 99 75.2187 93.7848 84.5018 84.5018C93.7848 75.2187 99 62.6282 99 49.5C99 36.3718 93.7848 23.7813 84.5018 14.4982C75.2187 5.21517 62.6282 0 49.5 0V0ZM77.7209 67.538L67.5321 77.7268L49.5 59.6888L31.462 77.7209L21.2732 67.5321L39.3171 49.5L21.2791 31.462L31.4679 21.2791L49.5 39.3113L67.538 21.2732L77.7268 31.462L59.6829 49.5L77.7209 67.538Z" fill="#142D6B"/>
      </svg>
    )
  }
  return (
    <svg className="h-14 w-14" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M48 0C38.5065 0 29.2262 2.81515 21.3326 8.08946C13.4391 13.3638 7.28681 20.8603 3.6538 29.6312C0.0207976 38.402 -0.929762 48.0532 0.922328 57.3643C2.77442 66.6754 7.34597 75.2282 14.0589 81.9411C20.7718 88.654 29.3246 93.2256 38.6357 95.0777C47.9468 96.9298 57.598 95.9792 66.3688 92.3462C75.1397 88.7132 82.6362 82.5609 87.9105 74.6674C93.1849 66.7738 96 57.4935 96 48C96 35.2696 90.9429 23.0606 81.9411 14.0589C72.9394 5.05713 60.7304 0 48 0ZM41.1429 67.1657L24 50.0228L29.4514 44.5714L41.1429 56.2628L66.5486 30.8571L72.0206 36.2949L41.1429 67.1657Z" fill="#142D6B"/>
    </svg>
  )
}

const Result = ({ response, setResponse }: ResultProp) => {
  return (
    <div className="flex flex-col basis-0 py-8 flex-grow rounded-lg px-8 transition-all ease-in-out duration-300 bg-white overflow-hidden shadow-md">
      <svg className="h-8 w-8 cursor-pointer" onClick={() => setResponse(undefined)} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.9168 10.4166L8.3335 25L22.9168 39.5833" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8.3335 25H41.6668" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div className="mt-4 flex flex-col items-center text-center">
        {verificationIcon(response?.status)}
        {(!!response && response?.status !== 'false') ? <Found response={response} /> : <NotFound address={response?.address} />}
      </div>
    </div>
  )
}

export default Result
