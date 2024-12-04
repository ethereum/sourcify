// TODO: Handle nodejs only dependencies
import path from "path";
import fs from "fs";
import { exec, spawnSync } from "child_process";
import { StatusCodes } from "http-status-codes";

import logger from "../../../../common/logger";
import { VyperJsonInput, VyperOutput } from "@ethereum-sourcify/lib-sourcify";
import { fetchWithBackoff } from "./common";

const HOST_VYPER_REPO = "https://github.com/vyperlang/vyper/releases/download/";

export function findVyperPlatform(): string | false {
  if (process.platform === "darwin") {
    return "darwin";
  }
  if (process.platform === "linux" && process.arch === "x64") {
    return "linux";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "windows.exe";
  }
  return false;
}
/**
 * Searches for a vyper compiler: first for a local executable version, then from HOST_VYPER_REPO
 * Once the compiler is retrieved, it is used, and the stringified vyper output is returned.
 *
 * @param version the version of vyper to be used for compilation
 * @param input a JSON object of the standard-json format compatible with vyper
 * @param log the logger
 * @returns stringified vyper output
 */

export async function useVyperCompiler(
  vyperRepoPath: string,
  version: string,
  vyperJsonInput: VyperJsonInput,
): Promise<VyperOutput> {
  const vyperPlatform = findVyperPlatform();
  let vyperPath;
  if (vyperPlatform) {
    vyperPath = await getVyperExecutable(vyperRepoPath, vyperPlatform, version);
  }

  if (!vyperPath) {
    throw new Error("Vyper path not found");
  }

  let compiled: string | undefined;
  const inputStringified = JSON.stringify(vyperJsonInput);
  const startCompilation = Date.now();
  try {
    compiled = await asyncExecVyper(inputStringified, vyperPath);
  } catch (error: any) {
    if (error?.code === "ENOBUFS") {
      throw new Error("Compilation output size too large");
    }
    logger.warn(error.message);
    throw error;
  }
  const endCompilation = Date.now();
  logger.info("Local compiler - Compilation done", {
    compiler: "vyper",
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

export async function getVyperExecutable(
  vyperRepoPath: string,
  platform: string,
  version: string,
): Promise<string | null> {
  const fileName = `vyper.${version}.${platform}`;
  const vyperPath = path.join(vyperRepoPath, fileName);
  if (fs.existsSync(vyperPath) && validateVyperPath(vyperPath)) {
    logger.debug("Found vyper binary", {
      version,
      vyperPath,
      platform,
    });
    return vyperPath;
  }

  logger.debug("Downloading vyper", {
    version,
    vyperPath,
    platform,
  });
  const success = await fetchAndSaveVyper(
    platform,
    vyperPath,
    version,
    fileName,
  );
  logger.debug("Downloaded vyper", {
    version,
    vyperPath,
    platform,
  });
  if (success && !validateVyperPath(vyperPath)) {
    logger.error("Cannot validate vyper", {
      version,
      vyperPath,
      platform,
    });
    return null;
  }
  return success ? vyperPath : null;
}

function validateVyperPath(vyperPath: string): boolean {
  // TODO: Handle nodejs only dependencies
  const spawned = spawnSync(vyperPath, ["--version"]);
  if (spawned.status === 0) {
    return true;
  }

  const error =
    spawned?.error?.message ||
    spawned.stderr.toString() ||
    "Error running vyper, are you on the right platform? (e.g. x64 vs arm)";

  logger.warn(error);
  return false;
}

/**
 * Fetches a vyper binary and saves it to the given path.
 */
async function fetchAndSaveVyper(
  platform: string,
  vyperPath: string,
  version: string,
  fileName: string,
): Promise<boolean> {
  const encodedURIFilename = encodeURIComponent(fileName);
  const versionWithoutCommit = version.split("+")[0];
  const githubVyperURI = `${HOST_VYPER_REPO}v${versionWithoutCommit}/${encodedURIFilename}`;
  logger.debug("Fetching vyper", {
    version,
    platform,
    vyperPath,
    githubVyperURI,
  });
  const res = await fetchWithBackoff(githubVyperURI);
  const status = res.status;
  const buffer = await res.arrayBuffer();

  if (status === StatusCodes.OK && buffer) {
    logger.debug("Fetched vyper", { version, platform, vyperPath });
    fs.mkdirSync(path.dirname(vyperPath), { recursive: true });

    try {
      fs.unlinkSync(vyperPath);
    } catch (_e) {
      undefined;
    }
    fs.writeFileSync(vyperPath, new DataView(buffer), { mode: 0o755 });

    return true;
  } else {
    logger.warn("Failed fetching vyper", { version, platform, vyperPath });
  }

  return false;
}

function asyncExecVyper(
  inputStringified: string,
  vyperPath: string,
): Promise<string> {
  // check if input is valid JSON. The input is untrusted and potentially cause arbitrary execution.
  JSON.parse(inputStringified);

  return new Promise((resolve, reject) => {
    const child = exec(
      `${vyperPath} --standard-json`,
      {
        maxBuffer: 1000 * 1000 * 20,
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
