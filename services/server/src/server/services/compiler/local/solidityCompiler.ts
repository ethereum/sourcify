// TODO: Handle nodejs only dependencies
import path from "path";
import fs from "fs";
import { exec, spawnSync } from "child_process";
import { StatusCodes } from "http-status-codes";
import semver from "semver";
import { Worker, WorkerOptions } from "worker_threads";
import {
  CompilerOutput,
  JsonInput,
  PathBuffer,
} from "@ethereum-sourcify/lib-sourcify";
import config from "config";
import logger from "../../../../common/logger";

/**
 * Fetches a resource with an exponential timeout.
 * 1) Send req, wait backoff * 2^0 ms, abort if doesn't resolve
 * 2) Send req, wait backoff * 2^1 ms, abort if doesn't resolve
 * 3) Send req, wait backoff * 2^2 ms, abort if doesn't resolve...
 * ...
 * ...
 */
export async function fetchWithBackoff(
  resource: string,
  backoff: number = 10000,
  retries: number = 4,
) {
  let timeout = backoff;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      logger.silly("Start fetchWithBackoff", { resource, timeout, attempt });
      const controller = new AbortController();
      const id = setTimeout(() => {
        logger.debug("Aborting request", { resource, timeout, attempt });
        controller.abort();
      }, timeout);
      const response = await fetch(resource, {
        signal: controller.signal,
      });
      logger.silly("Success fetchWithBackoff", { resource, timeout, attempt });
      clearTimeout(id);
      return response;
    } catch (error) {
      if (attempt === retries) {
        logger.error("Failed fetchWithBackoff", {
          resource,
          attempt,
          retries,
          timeout,
          error,
        });
        throw new Error(`Failed fetching ${resource}: ${error}`);
      } else {
        timeout *= 2; // exponential backoff
        logger.debug("Retrying fetchWithBackoff", {
          resource,
          attempt,
          timeout,
          error,
        });
        continue;
      }
    }
  }
  throw new Error(`Failed fetching ${resource}`);
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const solc = require("solc");

const HOST_SOLC_REPO = "https://binaries.soliditylang.org/";

export function findSolcPlatform(): string | false {
  if (process.platform === "darwin" && process.arch === "x64") {
    return "macosx-amd64";
  }
  if (process.platform === "linux" && process.arch === "x64") {
    return "linux-amd64";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "windows-amd64";
  }
  return false;
}
/**
 * Searches for a solc: first for a local executable version, then from HOST_SOLC_REPO
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
  solcJsonInput: JsonInput,
  forceEmscripten = false,
): Promise<CompilerOutput> {
  // For nightly builds, Solidity version is saved as 0.8.17-ci.2022.8.9+commit.6b60524c instead of 0.8.17-nightly.2022.8.9+commit.6b60524c.
  // Not possible to retrieve compilers with "-ci.".
  if (version.includes("-ci.")) version = version.replace("-ci.", "-nightly.");
  const inputStringified = JSON.stringify(solcJsonInput);
  let compiled: string | undefined;

  const solcPlatform = findSolcPlatform();
  let solcPath;
  if (solcPlatform && !forceEmscripten) {
    solcPath = await getSolcExecutable(solcPlatform, version);
  }
  let startCompilation: number;
  if (solcPath && !forceEmscripten) {
    logger.info("Compiling with solc binary", { version, solcPath });
    startCompilation = Date.now();
    try {
      compiled = await asyncExecSolc(inputStringified, solcPath);
    } catch (error: any) {
      if (error?.code === "ENOBUFS") {
        throw new Error("Compilation output size too large");
      }
      throw error;
    }
  } else {
    logger.info("Compiling with solc-js", { version });
    const solJson = await getSolcJs(version);
    startCompilation = Date.now();
    if (solJson) {
      const coercedVersion =
        semver.coerce(new semver.SemVer(version))?.version ?? "";
      // Run Worker for solc versions < 0.4.0 for clean compiler context. See https://github.com/ethereum/sourcify/issues/1099
      if (semver.lt(coercedVersion, "0.4.0")) {
        compiled = await new Promise((resolve, reject) => {
          const worker = importWorker(
            path.resolve(__dirname, "./compilerWorker.ts"),
            {
              workerData: { version, inputStringified },
            },
          );
          worker.once("message", (result) => {
            resolve(result);
          });
          worker.once("error", (error) => {
            reject(error);
          });
        });
      } else {
        compiled = solJson.compile(inputStringified);
      }
    }
  }

  const endCompilation = Date.now();
  logger.info("Local compiler - Compilation done", {
    timeInMs: endCompilation - startCompilation,
  });

  if (!compiled) {
    throw new Error("Compilation failed. No output from the compiler.");
  }
  const compiledJSON = JSON.parse(compiled);
  const errorMessages = compiledJSON?.errors?.filter(
    (e: any) => e.severity === "error",
  );
  if (errorMessages && errorMessages.length > 0) {
    const error = new Error(
      "Compiler error:\n " + JSON.stringify(errorMessages),
    );
    logger.error(error.message);
    throw error;
  }
  return compiledJSON;
}

export async function getAllMetadataAndSourcesFromSolcJson(
  solcJson: JsonInput,
  compilerVersion: string,
): Promise<PathBuffer[]> {
  if (solcJson.language !== "Solidity")
    throw new Error(
      "Only Solidity is supported, the json has language: " + solcJson.language,
    );

  const outputSelection = {
    "*": {
      "*": ["metadata"],
    },
  };
  if (!solcJson.settings) {
    solcJson.settings = {
      outputSelection: outputSelection,
    };
  }
  solcJson.settings.outputSelection = outputSelection;
  const compiled = await useCompiler(compilerVersion, solcJson);
  const metadataAndSources: PathBuffer[] = [];
  if (!compiled.contracts)
    throw new Error("No contracts found in the compiled json output");
  for (const contractPath in compiled.contracts) {
    for (const contract in compiled.contracts[contractPath]) {
      const metadata = compiled.contracts[contractPath][contract].metadata;
      const metadataPath = `${contractPath}-metadata.json`;
      metadataAndSources.push({
        path: metadataPath,
        buffer: Buffer.from(metadata),
      });
      metadataAndSources.push({
        path: `${contractPath}`,
        buffer: Buffer.from(solcJson.sources[contractPath].content as string),
      });
    }
  }
  return metadataAndSources;
}

export async function getSolcExecutable(
  platform: string,
  version: string,
): Promise<string | null> {
  const fileName = `solc-${platform}-v${version}`;
  const repoPath =
    (config.get("solcRepo") as string) || path.join("/tmp", "solc-repo");
  const solcPath = path.join(repoPath, fileName);
  if (fs.existsSync(solcPath) && validateSolcPath(solcPath)) {
    logger.debug("Found existing solc", { version, platform, solcPath });
    return solcPath;
  }

  const success = await fetchAndSaveSolc(platform, solcPath, version, fileName);
  if (success && !validateSolcPath(solcPath)) {
    logger.error(`Cannot validate solc ${version}.`);
    return null;
  }
  return success ? solcPath : null;
}

function validateSolcPath(solcPath: string): boolean {
  // TODO: Handle nodejs only dependencies
  const spawned = spawnSync(solcPath, ["--version"]);
  if (spawned.status === 0) {
    return true;
  }

  const error =
    spawned?.error?.message ||
    spawned.stderr.toString() ||
    "Error running solc, are you on the right platoform? (e.g. x64 vs arm)";

  logger.warn(error);
  return false;
}

/**
 * Fetches a solc binary and saves it to the given path.
 *
 * If platform is "bin", it will download the solc-js binary.
 */
async function fetchAndSaveSolc(
  platform: string,
  solcPath: string,
  version: string,
  fileName: string,
): Promise<boolean> {
  const encodedURIFilename = encodeURIComponent(fileName);
  const githubSolcURI = `${HOST_SOLC_REPO}${platform}/${encodedURIFilename}`;
  logger.info("Fetching solc", { version, platform, githubSolcURI, solcPath });
  let res = await fetchWithBackoff(githubSolcURI);
  let status = res.status;
  let buffer;

  // handle case in which the response is a link to another version
  if (status === StatusCodes.OK) {
    buffer = await res.arrayBuffer();
    const responseText = Buffer.from(buffer).toString();
    if (
      /^([\w-]+)-v(\d+\.\d+\.\d+)\+commit\.([a-fA-F0-9]+).*$/.test(responseText)
    ) {
      const githubSolcURI = `${HOST_SOLC_REPO}${platform}/${responseText}`;
      res = await fetchWithBackoff(githubSolcURI);
      status = res.status;
      buffer = await res.arrayBuffer();
    }
  }

  if (status === StatusCodes.OK && buffer) {
    fs.mkdirSync(path.dirname(solcPath), { recursive: true });

    try {
      fs.unlinkSync(solcPath);
    } catch (_e) {
      undefined;
    }
    fs.writeFileSync(solcPath, new DataView(buffer), { mode: 0o755 });
    logger.info("Saved solc", { version, platform, githubSolcURI, solcPath });

    return true;
  } else {
    logger.warn("Failed fetching solc", {
      version,
      platform,
      githubSolcURI,
      solcPath,
    });
  }

  return false;
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
export async function getSolcJs(version = "latest"): Promise<any> {
  // /^\d+\.\d+\.\d+\+commit\.[a-f0-9]{8}$/
  version = version.trim();
  if (version !== "latest" && !version.startsWith("v")) {
    version = "v" + version;
  }

  const soljsonRepo =
    (config.get("solJsonRepo") as string) || path.join("/tmp", "soljson-repo");
  const fileName = `soljson-${version}.js`;
  const soljsonPath = path.resolve(soljsonRepo, fileName);

  if (!fs.existsSync(soljsonPath)) {
    logger.debug("Solc-js not found locally, downloading", {
      version,
      soljsonPath,
    });
    if (!(await fetchAndSaveSolc("bin", soljsonPath, version, fileName))) {
      return false;
    }
  }

  const solcjsImports = await import(soljsonPath);
  return solc.setupMethods(solcjsImports);
}

function asyncExecSolc(
  inputStringified: string,
  solcPath: string,
): Promise<string> {
  // check if input is valid JSON. The input is untrusted and potentially cause arbitrary execution.
  JSON.parse(inputStringified);

  return new Promise((resolve, reject) => {
    const child = exec(
      `${solcPath} --standard-json`,
      {
        maxBuffer: 250 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else if (stderr) {
          reject(
            new Error(`Compiler process returned with errors:\n ${stderr}`),
          );
        } else {
          resolve(stdout);
        }
      },
    );
    if (!child.stdin) {
      throw new Error("No stdin on child process");
    }
    // Write input to child process's stdin
    child.stdin.write(inputStringified);
    child.stdin.end();
  });
}

// https://stackoverflow.com/questions/71795469/ts-node-using-worker-thread-cause-cannot-use-import-statement-outside-a-module
function importWorker(path: string, options: WorkerOptions) {
  const resolvedPath = require.resolve(path);
  return new Worker(resolvedPath, {
    ...options,
    execArgv: /\.ts$/.test(resolvedPath)
      ? ["--require", "ts-node/register"]
      : undefined,
  });
}
