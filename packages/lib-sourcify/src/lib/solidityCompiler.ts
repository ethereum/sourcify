// TODO: Handle nodejs only dependencies
import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { fetchWithTimeout } from './utils';
import { StatusCodes } from 'http-status-codes';
import { JsonInput } from './types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const solc = require('solc');

const GITHUB_SOLC_REPO =
  'https://github.com/ethereum/solc-bin/raw/gh-pages/linux-amd64/';
const RECOMPILATION_ERR_MSG =
  'Recompilation error (probably caused by invalid metadata)';

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

export async function useCompiler(version: string, solcJsonInput: JsonInput) {
  // For nightly builds, Solidity version is saved as 0.8.17-ci.2022.8.9+commit.6b60524c instead of 0.8.17-nightly.2022.8.9+commit.6b60524c.
  // Not possible to retrieve compilers with "-ci.".
  if (version.includes('-ci.')) version = version.replace('-ci.', '-nightly.');
  const inputStringified = JSON.stringify(solcJsonInput);
  const solcPath = await getSolcExecutable(version);
  let compiled: string | undefined;

  if (solcPath) {
    const shellOutputBuffer = spawnSync(solcPath, ['--standard-json'], {
      input: inputStringified,
      maxBuffer: 1000 * 1000 * 10,
    });

    // Handle errors.
    let error: false | Error = false;
    if (shellOutputBuffer.error) {
      const typedError: NodeJS.ErrnoException = shellOutputBuffer.error;
      // Handle compilation output size > stdout buffer
      if (typedError.code === 'ENOBUFS') {
        error = new Error('Compilation output size too large');
      }
      error = new Error('Compilation Error');
    }
    if (!shellOutputBuffer.stdout) {
      error = new Error(RECOMPILATION_ERR_MSG);
    }
    if (error) {
      console.error(error);
      throw error;
    }
    compiled = shellOutputBuffer.stdout.toString();
  } else {
    const soljson = await getSolcJs(version);
    compiled = soljson.compile(inputStringified);
  }

  if (!compiled) {
    throw new Error('Compilation failed. No output from the compiler.');
  }
  const compiledJSON = JSON.parse(compiled);
  const errorMessages = compiledJSON?.errors?.filter(
    (e: any) => e.severity === 'error'
  );
  if (errorMessages && errorMessages.length > 0) {
    const error = new Error(
      'Compiler error:\n ' + JSON.stringify(errorMessages)
    );
    console.error(error);
    throw error;
  }
  console.log(`Compiled successfully with solc version ${version}`);
  return compiledJSON;
}

// TODO: Handle where and how solc is saved
async function getSolcExecutable(version: string): Promise<string | null> {
  const fileName = `solc-linux-amd64-v${version}`;
  const repoPath = process.env.SOLC_REPO || path.join('/tmp', 'solc-repo');
  const solcPath = path.join(repoPath, fileName);
  if (fs.existsSync(solcPath) && validateSolcPath(solcPath)) {
    return solcPath;
  }
  const success = await fetchSolcFromGitHub(solcPath, version, fileName);
  return success ? solcPath : null;
}

function validateSolcPath(solcPath: string): boolean {
  // TODO: Handle nodejs only dependencies
  const spawned = spawnSync(solcPath, ['--version']);
  if (spawned.status === 0) {
    return true;
  }

  const error =
    spawned?.error?.message ||
    spawned.stderr.toString() ||
    'Error running solc, are you on the right platoform? (e.g. x64 vs arm)';

  console.log(error);
  return false;
}

async function fetchSolcFromGitHub(
  solcPath: string,
  version: string,
  fileName: string
): Promise<boolean> {
  const githubSolcURI = GITHUB_SOLC_REPO + encodeURIComponent(fileName);
  const res = await fetchWithTimeout(githubSolcURI);
  // TODO: Handle nodejs only dependencies
  if (res.status === StatusCodes.OK) {
    fs.mkdirSync(path.dirname(solcPath), { recursive: true });
    const buffer = await res.arrayBuffer();

    try {
      fs.unlinkSync(solcPath);
    } catch (_e) {
      undefined;
    }
    fs.writeFileSync(solcPath, new DataView(buffer), { mode: 0o755 });
    if (validateSolcPath(solcPath)) {
      console.log(
        `Successfully fetched solc ${version} from GitHub: ${githubSolcURI}`
      );
      return true;
    }
  } else {
    console.log(
      `Failed fetching solc ${version} from GitHub: ${githubSolcURI}`
    );
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
export function getSolcJs(version = 'latest'): Promise<any> {
  // /^\d+\.\d+\.\d+\+commit\.[a-f0-9]{8}$/
  version = version.trim();
  if (version !== 'latest' && !version.startsWith('v')) {
    version = 'v' + version;
  }

  const soljsonRepo = process.env.SOLJSON_REPO || 'soljson-repo';
  const soljsonPath = path.resolve(soljsonRepo, `soljson-${version}.js`);

  if (fs.existsSync(soljsonPath)) {
    console.log(`Using local solcjs ${version} from ${soljsonPath}`);
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const soljson = solc.setupMethods(require(soljsonPath));
      resolve(soljson);
    });
  }

  return new Promise((resolve, reject) => {
    solc.loadRemoteVersion(version, (error: Error, soljson: any) => {
      if (error) {
        console.error(error);
        reject(error);
      } else {
        console.log(`Got solcjs ${version}`);
        resolve(soljson);
      }
    });
  });
}
