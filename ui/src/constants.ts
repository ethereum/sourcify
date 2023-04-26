export const REPOSITORY_SERVER_URL =
  process.env.REACT_APP_REPOSITORY_SERVER_URL;
export const SERVER_URL = process.env.REACT_APP_SERVER_URL;
export const DOCS_URL = "https://docs.sourcify.dev";
export const PLAYGROUND_URL = "https://playground.sourcify.dev";

export const REPOSITORY_SERVER_URL_FULL_MATCH = `${REPOSITORY_SERVER_URL}/contracts/full_match`;
export const REPOSITORY_SERVER_URL_PARTIAL_MATCH = `${REPOSITORY_SERVER_URL}/contracts/partial_match`;
export const IPFS_IPNS_GATEWAY_URL = `https://cloudflare-ipfs.com/ipns/${process.env.REACT_APP_IPNS}`;
export const GITTER_URL = `https://gitter.im/ethereum/source-verify`;
export const GITHUB_URL = `https://github.com/ethereum/sourcify`;
export const TWITTER_URL = `https://twitter.com/sourcifyeth`;
export const SOLIDITY_ETHEREUM_URL = `https://solidity.ethereum.org/2020/06/25/sourcify-faq/`;

// SESSION API
export const SESSION_DATA_URL = `${SERVER_URL}/session/data`;
export const ADD_FILES_URL = `${SERVER_URL}/session/input-files`;
export const ADD_SOLC_JSON_URL = `${SERVER_URL}/session/input-solc-json`;
export const ADD_FILES_FROM_CONTRACT_URL = `${SERVER_URL}/session/input-contract`;
export const VERIFY_VALIDATED_URL = `${SERVER_URL}/session/verify-validated`;
export const VERIFY_FROM_ETHERSCAN = `${SERVER_URL}/session/verify/etherscan`;
export const CREATE2_VERIFY_VALIDATED_URL = `${SERVER_URL}/session/verify/create2`;
export const CREATE2_COMPILE_URL = `${SERVER_URL}/session/verify/create2/compile`;
export const RESTART_SESSION_URL = `${SERVER_URL}/session/clear`;
