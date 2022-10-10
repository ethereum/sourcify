import Web3 from "web3";
import { HttpProvider } from "web3-core";
import fetch from "node-fetch";
import {
  StringMap,
  createJsonInputFromMetadata,
  InfoErrorLogger,
} from "@ethereum-sourcify/core";
import Path from "path";
import fs from "fs";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const solc = require("solc");
import { spawnSync } from "child_process";
import { StatusCodes } from "http-status-codes";
import { ethers } from "ethers";
import promiseAny = require("promise.any"); // use import require to avoid error from typescript see: https://github.com/es-shims/Promise.allSettled/issues/5#issuecomment-723485612

const GITHUB_SOLC_REPO =
  "https://github.com/ethereum/solc-bin/raw/gh-pages/linux-amd64/";

export interface RecompilationResult {
  creationBytecode?: string;
  deployedBytecode?: string;
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
  if (!web3Array.length) return;
  address = Web3.utils.toChecksumAddress(address);

  // Check if the first provider is a local node (using NODE_ADDRESS). If so don't waste Alchemy requests by requesting all RPCs in parallel.
  // Instead request first the local node and request Alchemy only if it fails.
  const firstProvider = web3Array[0].currentProvider as HttpProvider;
  if (firstProvider?.host?.includes(process.env.NODE_ADDRESS)) {
    let rejectResponse;
    for (const web3 of web3Array) {
      try {
        const bytecode = await raceWithTimeout(web3, RPC_TIMEOUT, address); // await sequentially
        return bytecode;
      } catch (err) {
        rejectResponse = err;
      }
    }
    throw rejectResponse; // None resolved
  } else {
    // No local node. Request all public RPCs in parallel.
    const rpcPromises: Promise<string>[] = web3Array.map((web3) =>
      raceWithTimeout(web3, RPC_TIMEOUT, address)
    );
    // Promise.any for Node v15.0.0<  i.e. return the first one that resolves.
    return promiseAny(rpcPromises);
  }
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
  sources: StringMap,
  log: InfoErrorLogger
): Promise<RecompilationResult> {
  const { solcJsonInput, fileName, contractName } = createJsonInputFromMetadata(
    metadata,
    sources,
    log
  );

  const loc = "[RECOMPILE]";
  const version = metadata.compiler.version;

  log.info({ loc, fileName, contractName, version }, "Recompiling");

  const output = await useCompiler(version, solcJsonInput, log);
  if (
    !output.contracts ||
    !output.contracts[fileName] ||
    !output.contracts[fileName][contractName] ||
    !output.contracts[fileName][contractName].evm ||
    !output.contracts[fileName][contractName].evm.bytecode
  ) {
    const errorMessages = output.errors
      .filter((e: any) => e.severity === "error")
      .map((e: any) => e.formattedMessage)
      .join("\n");
    log.error({ loc, fileName, contractName, version, errorMessages });
    throw new Error("Compiler error:\n " + errorMessages);
    // throw new Error(RECOMPILATION_ERR_MSG);
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
export async function useCompiler(
  version: string,
  solcJsonInput: any,
  log: InfoErrorLogger
) {
  const inputStringified = JSON.stringify(solcJsonInput);
  const solcPath = await getSolcExecutable(version, log);
  let compiled: string = null;

  if (solcPath) {
    const logObject = { loc: "[RECOMPILE]", version, solcPath };
    log.info(logObject, "Compiling with external executable");

    const shellOutputBuffer = spawnSync(solcPath, ["--standard-json"], {
      input: inputStringified,
      maxBuffer: 1000 * 1000 * 10,
    });

    // Handle errors.
    if (shellOutputBuffer.error) {
      const typedError: NodeJS.ErrnoException = shellOutputBuffer.error;
      // Handle compilation output size > stdout buffer
      if (typedError.code === "ENOBUFS") {
        log.error(logObject, shellOutputBuffer.error || RECOMPILATION_ERR_MSG);
        throw new Error("Compilation output size too large");
      }
      log.error(logObject, shellOutputBuffer.error || RECOMPILATION_ERR_MSG);
      throw new Error("Compilation Error");
    }
    if (!shellOutputBuffer.stdout) {
      log.error(logObject, shellOutputBuffer.error || RECOMPILATION_ERR_MSG);
      throw new Error(RECOMPILATION_ERR_MSG);
    }
    compiled = shellOutputBuffer.stdout.toString();
  } else {
    const soljson = await getSolcJs(version, log);
    compiled = soljson.compile(inputStringified);
  }

  const compiledJSON = JSON.parse(compiled);
  const errorMessages = compiledJSON?.errors
    ?.filter((e: any) => e.severity === "error")
    .map((e: any) => e.formattedMessage)
    .join("\n");
  if (errorMessages) {
    log.error({ loc: "[RECOMPILE]", version }, errorMessages);
    throw new Error("Compiler error:\n " + errorMessages);
  }
  return compiledJSON;
}

function validateSolcPath(solcPath: string, log: InfoErrorLogger): boolean {
  const spawned = spawnSync(solcPath, ["--version"]);
  if (spawned.status === 0) {
    return true;
  }

  const error =
    spawned?.error?.message ||
    spawned.stderr.toString() ||
    "Error running solc, are you on the right platoform? (e.g. x64 vs arm)";
  log.error({ loc: "[VALIDATE_SOLC_PATH]", solcPath, error });
  return false;
}

async function getSolcExecutable(
  version: string,
  log: InfoErrorLogger
): Promise<string> {
  const fileName = `solc-linux-amd64-v${version}`;
  const tmpSolcRepo =
    process.env.SOLC_REPO_TMP || Path.join("/tmp", "solc-repo");

  const repoPaths = [tmpSolcRepo, process.env.SOLC_REPO || "solc-repo"];
  for (const repoPath of repoPaths) {
    const solcPath = Path.join(repoPath, fileName);
    if (fs.existsSync(solcPath) && validateSolcPath(solcPath, log)) {
      return solcPath;
    }
  }

  const tmpSolcPath = Path.join(tmpSolcRepo, fileName);
  const success = await fetchSolcFromGitHub(
    tmpSolcPath,
    version,
    fileName,
    log
  );
  return success ? tmpSolcPath : null;
}

async function fetchSolcFromGitHub(
  solcPath: string,
  version: string,
  fileName: string,
  log: InfoErrorLogger
): Promise<boolean> {
  const githubSolcURI = GITHUB_SOLC_REPO + encodeURIComponent(fileName);
  const logObject = { loc: "[RECOMPILE]", version, githubSolcURI };
  log.info(logObject, "Fetching executable solc from GitHub");

  const res = await fetch(githubSolcURI);
  if (res.status === StatusCodes.OK) {
    log.info(logObject, "Successfully fetched executable solc from GitHub");
    fs.mkdirSync(Path.dirname(solcPath), { recursive: true });
    const buffer = await res.buffer();

    try {
      fs.unlinkSync(solcPath);
    } catch (_e) {
      undefined;
    }
    fs.writeFileSync(solcPath, buffer, { mode: 0o755 });
    if (validateSolcPath(solcPath, log)) {
      return true;
    }
  } else {
    log.error(logObject, "Failed fetching executable solc from GitHub");
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
export function getSolcJs(
  version = "latest",
  log: InfoErrorLogger
): Promise<any> {
  // /^\d+\.\d+\.\d+\+commit\.[a-f0-9]{8}$/
  version = version.trim();
  if (version !== "latest" && !version.startsWith("v")) {
    version = "v" + version;
  }

  const soljsonRepo = process.env.SOLJSON_REPO || "soljson-repo";
  const soljsonPath = Path.resolve(soljsonRepo, `soljson-${version}.js`);
  log.info(
    { loc: "[GET_SOLC]", target: soljsonPath },
    "Searching for js solc locally"
  );

  if (fs.existsSync(soljsonPath)) {
    log.info({ loc: "[GET_SOLC]" }, "Found js solc locally");
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const soljson = solc.setupMethods(require(soljsonPath));
      resolve(soljson);
    });
  }

  log.info({ loc: "[GET_SOLC]", version }, "Searching for js solc remotely");
  return new Promise((resolve, reject) => {
    solc.loadRemoteVersion(version, (error: Error, soljson: any) => {
      if (error) {
        log.error(
          { loc: "[GET_SOLC]", version },
          "Could not find solc remotely"
        );
        reject(error);
      } else {
        log.info({ loc: "[GET_SOLC]", version }, "Found solc remotely");
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
