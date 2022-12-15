import Web3 from "web3";
import { HttpProvider } from "web3-core";
import fetch from "node-fetch";
import {
  StringMap,
  createJsonInputFromMetadata,
  InfoErrorLogger,
  SourcifyEventManager,
} from "@ethereum-sourcify/core";
import Path from "path";
import fs from "fs";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const solc = require("solc");
import { spawnSync } from "child_process";
import { StatusCodes } from "http-status-codes";
import { ethers } from "ethers";

const GITHUB_SOLC_REPO =
  "https://github.com/ethereum/solc-bin/raw/gh-pages/linux-amd64/";

export interface RecompilationResult {
  creationBytecode: string;
  deployedBytecode: string;
  metadata: string;
}

/**
 * Checks if provided endpoint is online
 * @param {string} provider personal project ID from infura.io or real Ethereum node endpoint
 */
export async function checkEndpoint(provider: string): Promise<void> {
  const web3 = new Web3(provider);
  await web3.eth.getNodeInfo().catch(() => {
    throw new Error("Check your node");
  });
}

/**
 * Function to execute promises sequentially and return the first resolved one. Reject if none resolves.
 *
 * @param promiseArray
 */
async function awaitSequentially(promiseArray: Promise<string>[]) {
  let rejectResponse;
  for (const p of promiseArray) {
    try {
      const resolveResponse = await p;
      return resolveResponse;
    } catch (err) {
      rejectResponse = err;
    }
  }
  throw rejectResponse;
}

const rejectInMs = (ms: number, host: string) =>
  new Promise<string>((_resolve, reject) => {
    setTimeout(() => reject(`RPC ${host} took too long to respond`), ms);
  });

// Races the web3.eth.getCode call with a timeout promise. Returns a wrapper Promise that rejects if getCode call takes longer than timeout.
function raceWithTimeout(web3: Web3, timeout: number, address: string) {
  const provider = web3.currentProvider as HttpProvider;
  return Promise.race([
    web3.eth.getCode(address),
    rejectInMs(timeout, provider.host),
  ]);
}
/**
 * Fetches the contract's deployed bytecode from given web3 providers.
 * Tries to fetch sequentially if the first RPC is a local eth node. Fetches in parallel otherwise.
 *
 * @param {Web3[]} web3Array - web3 instances for the chain of the contract
 * @param {string} address - contract address
 */
export async function getBytecode(
  web3Array: Web3[],
  address: string
): Promise<string> {
  const RPC_TIMEOUT = 5000; // ms
  if (!web3Array.length)
    throw new Error("No RPC provider was given for this chain.");
  address = Web3.utils.toChecksumAddress(address);

  // Request sequentially. Custom node is always before ALCHEMY so we don't waste resources if succeeds.
  // TODO: remove promise-any dependency
  for (const web3 of web3Array) {
    try {
      const bytecode = await raceWithTimeout(web3, RPC_TIMEOUT, address);
      if (bytecode) {
        SourcifyEventManager.trigger("Verification.ExecutionBytecodeFetched", {
          chain: (await web3.eth.getChainId()).toString(),
          address: address,
          executionBytecode: bytecode,
        });
      }
      return bytecode;
    } catch (err) {
      console.log(err);
    }
  }
  throw new Error("None of the RPCs responded");
}

const RECOMPILATION_ERR_MSG =
  "Recompilation error (probably caused by invalid metadata)";

/**
 * Compiles sources using version and settings specified in metadata
 * @param  {any}                          metadata
 * @param  {string[]}                     sources  solidity files
 * @return {Promise<RecompilationResult>}
 */
export async function recompile(
  metadata: any,
  sources: StringMap
): Promise<RecompilationResult> {
  let solcJsonInput, fileName, contractName;
  try {
    ({ solcJsonInput, fileName, contractName } = createJsonInputFromMetadata(
      metadata,
      sources
    ));
  } catch (e) {
    const error = new Error("Cannot parse metadata");
    SourcifyEventManager.trigger("Verification.Error", {
      message: error.message,
      stack: error.stack,
      details: {
        metadata,
        sources,
        fileName,
        contractName,
      },
    });
    throw error;
  }

  const version = metadata.compiler.version;

  const output = await useCompiler(version, solcJsonInput);
  if (
    !output.contracts ||
    !output.contracts[fileName] ||
    !output.contracts[fileName][contractName] ||
    !output.contracts[fileName][contractName].evm ||
    !output.contracts[fileName][contractName].evm.bytecode
  ) {
    const errorMessages = output.errors
      .filter((e: any) => e.severity === "error")
      .map((e: any) => e.formattedMessage);

    const error = new Error("Compiler error");
    SourcifyEventManager.trigger("Verification.Error", {
      message: error.message,
      stack: error.stack,
      details: {
        metadata,
        sources,
        fileName,
        contractName,
        version,
        errorMessages,
      },
    });
    throw error;
  }

  const contract: any = output.contracts[fileName][contractName];
  return {
    creationBytecode: `0x${contract.evm.bytecode.object}`,
    deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
    metadata: contract.metadata.trim(),
  };
}

export function findContractPathFromContractName(
  contracts: any,
  contractName: string
): string | null {
  for (const key of Object.keys(contracts)) {
    const contractsList = contracts[key];
    if (Object.keys(contractsList).includes(contractName)) {
      return key;
    }
  }
  return null;
}

/**
 * Searches for a solc: first for a local executable version, then from GitHub
 * and then using the getSolcJs function.
 * Once the compiler is retrieved, it is used, and the stringified solc output is returned.
 *
 * @param version the version of solc to be used for compilation
 * @param input a JSON object of the standard-json format compatible with solc
 * @param log the logger
 * @returns stringified solc output
 */
export async function useCompiler(version: string, solcJsonInput: any) {
  // For nightly builds, Solidity version is saved as 0.8.17-ci.2022.8.9+commit.6b60524c instead of 0.8.17-nightly.2022.8.9+commit.6b60524c.
  // Not possible to retrieve compilers with "-ci.".
  if (version.includes("-ci.")) version = version.replace("-ci.", "-nightly.");
  const inputStringified = JSON.stringify(solcJsonInput);
  const solcPath = await getSolcExecutable(version);
  let compiled: string | undefined;

  if (solcPath) {
    const shellOutputBuffer = spawnSync(solcPath, ["--standard-json"], {
      input: inputStringified,
      maxBuffer: 1000 * 1000 * 10,
    });

    // Handle errors.
    let error: false | Error = false;
    if (shellOutputBuffer.error) {
      const typedError: NodeJS.ErrnoException = shellOutputBuffer.error;
      // Handle compilation output size > stdout buffer
      if (typedError.code === "ENOBUFS") {
        error = new Error("Compilation output size too large");
      }
      error = new Error("Compilation Error");
    }
    if (!shellOutputBuffer.stdout) {
      error = new Error(RECOMPILATION_ERR_MSG);
    }
    if (error) {
      SourcifyEventManager.trigger("Verification.Error", {
        message: error.message,
        stack: error.stack,
        details: {
          version,
          solcPath,
          compilationError: shellOutputBuffer.error || RECOMPILATION_ERR_MSG,
          solcJsonInput,
        },
      });
      throw error;
    }
    compiled = shellOutputBuffer.stdout.toString();
  } else {
    const soljson = await getSolcJs(version);
    compiled = soljson.compile(inputStringified);
  }

  if (!compiled) {
    throw new Error("Compilation failed. No output from the compiler.");
  }
  const compiledJSON = JSON.parse(compiled);
  const errorMessages = compiledJSON?.errors?.filter(
    (e: any) => e.severity === "error"
  );
  if (errorMessages && errorMessages.length > 0) {
    const error = new Error("Compiler error:\n " + errorMessages);
    SourcifyEventManager.trigger("Verification.Error", {
      message: error.message,
      stack: error.stack,
      details: {
        version,
        solcPath,
        solcJsonInput,
        compilationError: errorMessages,
      },
    });
    throw error;
  }
  SourcifyEventManager.trigger("Verification.Compiled", {
    version,
    solcPath,
    solcJsonInput,
  });
  return compiledJSON;
}

function validateSolcPath(solcPath: string): boolean {
  const spawned = spawnSync(solcPath, ["--version"]);
  if (spawned.status === 0) {
    return true;
  }

  const error =
    spawned?.error?.message ||
    spawned.stderr.toString() ||
    "Error running solc, are you on the right platoform? (e.g. x64 vs arm)";

  SourcifyEventManager.trigger("Verification.Error", {
    message: error,
    details: {
      solcPath,
    },
  });
  return false;
}

async function getSolcExecutable(version: string): Promise<string | null> {
  const fileName = `solc-linux-amd64-v${version}`;
  const tmpSolcRepo =
    process.env.SOLC_REPO_TMP || Path.join("/tmp", "solc-repo");

  const repoPaths = [tmpSolcRepo, process.env.SOLC_REPO || "solc-repo"];
  for (const repoPath of repoPaths) {
    const solcPath = Path.join(repoPath, fileName);
    if (fs.existsSync(solcPath) && validateSolcPath(solcPath)) {
      return solcPath;
    }
  }

  const tmpSolcPath = Path.join(tmpSolcRepo, fileName);
  const success = await fetchSolcFromGitHub(tmpSolcPath, version, fileName);
  return success ? tmpSolcPath : null;
}

async function fetchSolcFromGitHub(
  solcPath: string,
  version: string,
  fileName: string
): Promise<boolean> {
  const githubSolcURI = GITHUB_SOLC_REPO + encodeURIComponent(fileName);
  const res = await fetch(githubSolcURI);
  if (res.status === StatusCodes.OK) {
    fs.mkdirSync(Path.dirname(solcPath), { recursive: true });
    const buffer = await res.buffer();

    try {
      fs.unlinkSync(solcPath);
    } catch (_e) {
      undefined;
    }
    fs.writeFileSync(solcPath, buffer, { mode: 0o755 });
    if (validateSolcPath(solcPath)) {
      SourcifyEventManager.trigger("Verification.GotSolcGithub", {
        source: "remote",
        version,
        url: githubSolcURI,
      });
      return true;
    }
  } else {
    SourcifyEventManager.trigger("Verification.Error", {
      message: "Failed fetching executable solc from GitHub",
      details: {
        source: "remote",
        version,
        url: githubSolcURI,
      },
    });
  }

  return false;
}

/**
 * Removes the appended CBOR encoded auxdata from a bytecode string
 * (for partial bytecode match comparisons )
 * @param  {string} bytecode
 * @return {string} bytecode minus auxdata
 */
export function trimAuxdata(bytecode: string): string {
  // Last 4 chars of bytecode specify byte size of metadata component,
  const auxdataSize = parseInt(bytecode.slice(-4), 16) * 2 + 4;
  // When the length of auxdaha is not appended at the end, it will likely overshoot. There's no auxdata to trim.
  if (auxdataSize > bytecode.length) {
    return bytecode;
  }
  return bytecode.slice(0, bytecode.length - auxdataSize);
}

/**
 * Fetches the requested version of the Solidity compiler (soljson).
 * First attempts to search locally; if that fails, falls back to downloading it.
 *
 * @param version the solc version to retrieve: the expected format is
 *
 * "[v]<major>.<minor>.<patch>+commit.<hash>"
 *
 * e.g.: "0.6.6+commit.6c089d02"
 *
 * defaults to "latest"
 *
 * @param log a logger to track the course of events
 *
 * @returns the requested solc instance
 */
export function getSolcJs(version = "latest"): Promise<any> {
  // /^\d+\.\d+\.\d+\+commit\.[a-f0-9]{8}$/
  version = version.trim();
  if (version !== "latest" && !version.startsWith("v")) {
    version = "v" + version;
  }

  const soljsonRepo = process.env.SOLJSON_REPO || "soljson-repo";
  const soljsonPath = Path.resolve(soljsonRepo, `soljson-${version}.js`);

  if (fs.existsSync(soljsonPath)) {
    SourcifyEventManager.trigger("Verification.GotSolcJS", {
      source: "local",
      version,
    });
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const soljson = solc.setupMethods(require(soljsonPath));
      resolve(soljson);
    });
  }

  return new Promise((resolve, reject) => {
    solc.loadRemoteVersion(version, (error: Error, soljson: any) => {
      if (error) {
        SourcifyEventManager.trigger("Verification.Error", {
          message: error.message,
          stack: error.stack,
          details: {
            source: "remote",
            version,
          },
        });
        reject(error);
      } else {
        SourcifyEventManager.trigger("Verification.GotSolcJS", {
          source: "local",
          version,
        });
        resolve(soljson);
      }
    });
  });
}

async function getCreationBlockNumber(
  contractAddress: string,
  web3: Web3
): Promise<number> {
  let highestBlock = await web3.eth.getBlockNumber();
  let lowestBlock = 0;

  let contractCode = await web3.eth.getCode(contractAddress, highestBlock);
  if (contractCode == "0x") {
    throw new Error(`Contract ${contractAddress} does not exist!`);
  }

  while (lowestBlock <= highestBlock) {
    const searchBlock = Math.floor((lowestBlock + highestBlock) / 2);
    contractCode = await web3.eth.getCode(contractAddress, searchBlock);

    if (contractCode != "0x") {
      highestBlock = searchBlock;
    } else if (contractCode == "0x") {
      lowestBlock = searchBlock;
    }

    if (highestBlock == lowestBlock + 1) {
      return highestBlock;
    }
  }
  throw new Error(`Could not find creation block for ${contractAddress}`);
}

/**
 * Modified and optimized version of https://www.shawntabrizi.com/ethereum-find-contract-creator/
 *
 * @param contractAddress the hexadecimal address of the contract
 * @param web3 initialized web3 object for chain requests
 * @returns a Promise of the creation data
 */
export async function getCreationDataFromArchive(
  contractAddress: string,
  web3: Web3
): Promise<string> {
  const creationBlockNumber = await getCreationBlockNumber(
    contractAddress,
    web3
  );
  const creationBlock = await web3.eth.getBlock(creationBlockNumber, true);
  const transactions = creationBlock.transactions;

  for (const i in transactions) {
    const transaction = transactions[i];

    const calculatedContractAddress =
      ethers.utils.getContractAddress(transaction);
    if (calculatedContractAddress === contractAddress) {
      return transaction.input;
    }
  }

  throw new Error(
    `Creation data of contract ${contractAddress} could not be located!`
  );
}

/**
 * Returns the data used for contract creation in the transaction found by the provided regex on the provided page.
 *
 * @param fetchAddress the URL from which to fetch the page to be scrapd
 * @param txRegex regex whose first group matches the transaction hash on the page
 * @param web3 initialized web3 object for chain requests
 * @returns a promise of the creation data
 */
export async function getCreationDataByScraping(
  fetchAddress: string,
  txRegex: string,
  web3: Web3
): Promise<string> {
  const res = await fetch(fetchAddress);
  const buffer = await res.buffer();
  const page = buffer.toString();
  if (res.status === StatusCodes.OK) {
    const matched = page.match(txRegex);
    if (matched && matched[1]) {
      const txHash = matched[1];
      const tx = await web3.eth.getTransaction(txHash);
      return tx.input;
    }
  }
  if (page.includes("captcha") || page.includes("CAPTCHA")) {
    throw new Error(
      "Scraping failed because of CAPTCHA requirement at ${fetchAddress}"
    );
  }
  throw new Error(`Creation data could not be scraped from ${fetchAddress}`);
}

export async function getCreationDataTelos(
  fetchAddress: string,
  web3: Web3
): Promise<string> {
  const res = await fetch(fetchAddress);
  if (res.status === StatusCodes.OK) {
    const response = await res.json();
    if (response.creation_trx) {
      const txHash = response.creation_trx;
      const tx = await web3.eth.getTransaction(txHash);
      return tx.input;
    }
  }

  throw new Error(`Creation data could not be scraped from ${fetchAddress}`);
}

export async function getCreationDataXDC(
  fetchAddress: string,
  web3: Web3
): Promise<string> {
  const res = await fetch(fetchAddress);
  if (res.status === StatusCodes.OK) {
    const response = await res.json();
    if (response.fromTxn) {
      const txHash = response.fromTxn;
      const tx = await web3.eth.getTransaction(txHash);
      return tx.input;
    }
  }

  throw new Error(`Creation data could not be scraped from ${fetchAddress}`);
}

export async function getCreationDataAvalancheSubnet(
  fetchAddress: string,
  web3: Web3
): Promise<string> {
  const res = await fetch(fetchAddress);
  if (res.status === StatusCodes.OK) {
    const response = await res.json();
    if (response.contract?.creator?.tx) {
      const txHash = response.contract?.creator?.tx;
      const tx = await web3.eth.getTransaction(txHash);
      return tx.input;
    }
  }

  throw new Error(`Creation data could not be fetched from ${fetchAddress}`);
}

export async function getCreationDataMeter(
  fetchAddress: string,
  web3: Web3
): Promise<string> {
  const res = await fetch(fetchAddress);
  if (res.status === StatusCodes.OK) {
    const response = await res.json();
    if (response.account?.creationTxHash) {
      const txHash = response.account.creationTxHash;
      const tx = await web3.eth.getTransaction(txHash);
      return tx.input;
    }
  }

  throw new Error(`Creation data could not be scraped from ${fetchAddress}`);
}

export async function getCreationDataFromGraphQL(
  fetchAddress: string,
  contractAddress: string,
  web3: Web3
): Promise<string> {
  const body = JSON.stringify({
    query: `
        query AccountCreationTx {
        allAccounts(first:1, filter: {
            address:{
            equalTo:"${contractAddress.toLowerCase()}"
            },
            creationTx: {
            isNull: false
            }
        }) {
            nodes {
            creationTx
            }
        }
        }`,
  });

  const rawResponse = await fetch(fetchAddress, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body,
  });

  try {
    const resp = await rawResponse.json();
    const txHash = resp.data.allAccounts.nodes[0].creationTx;
    const tx = await web3.eth.getTransaction(txHash);
    return tx.input;
  } catch (err: any) {
    throw new Error(
      `Creation data could not be fetched from ${fetchAddress}, reason: ${err.message}`
    );
  }
}

export const buildCreate2Address = (
  factoryAddress: string,
  saltHex: string,
  byteCode: string
) => {
  return `0x${ethers.utils
    .keccak256(
      `0x${["ff", factoryAddress, saltHex, ethers.utils.keccak256(byteCode)]
        .map((x) => x.replace(/0x/, ""))
        .join("")}`
    )
    .slice(-40)}`.toLowerCase();
};

export const saltToHex = (salt: string | number) => {
  salt = salt.toString();
  if (ethers.utils.isHexString(salt)) {
    return salt;
  }

  return ethers.utils.id(salt);
};

export const encodeParams = (dataTypes: any[], data: any[]) => {
  const abiCoder = ethers.utils.defaultAbiCoder;
  return abiCoder.encode(dataTypes, data);
};

export const buildBytecode = (
  constructorTypes: any[],
  constructorArgs: any[],
  contractBytecode: string
) =>
  `${contractBytecode}${encodeParams(constructorTypes, constructorArgs).slice(
    2
  )}`;

export function getCreate2Address({
  factoryAddress,
  salt,
  contractBytecode,
  constructorTypes = [] as string[],
  constructorArgs = [] as any[],
}: {
  factoryAddress: string;
  salt: string | number;
  contractBytecode: string;
  constructorTypes?: string[];
  constructorArgs?: any[];
}) {
  return buildCreate2Address(
    factoryAddress,
    saltToHex(salt),
    buildBytecode(constructorTypes, constructorArgs, contractBytecode)
  );
}
