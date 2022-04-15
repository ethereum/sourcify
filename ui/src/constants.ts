export const REPOSITORY_URL = process.env.REACT_APP_REPOSITORY_URL;
export const SERVER_URL = process.env.REACT_APP_SERVER_URL;
export const DOCS_URL = "https://docs.sourcify.dev"
export const PLAYGROUND_URL = "https://playground.sourcify.dev"

export const REPOSITORY_URL_FULL_MATCH = `${REPOSITORY_URL}/contracts/full_match`;
export const REPOSITORY_URL_PARTIAL_MATCH = `${REPOSITORY_URL}/contracts/partial_match`;
export const IPFS_IPNS_GATEWAY_URL = `https://ipfs.ethdevops.io/ipns/${process.env.REACT_APP_IPNS}`;
export const GITTER_URL = `https://gitter.im/ethereum/source-verify`;
export const GITHUB_URL = `https://github.com/ethereum/sourcify`;
export const TWITTER_URL = `https://twitter.com/sourcifyeth`;
export const SOLIDITY_ETHEREUM_URL = `https://solidity.ethereum.org/2020/06/25/sourcify-faq/`;

// API 2
export const SESSION_DATA_URL = `${SERVER_URL}/session-data`;
export const ADD_FILES_URL = `${SERVER_URL}/input-files`;
export const VERIFY_VALIDATED_URL = `${SERVER_URL}/verify-validated`;
export const RESTART_SESSION_URL = `${SERVER_URL}/restart-session`;
