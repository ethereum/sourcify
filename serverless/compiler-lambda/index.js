// TODO: Handle nodejs only dependencies
const path = require("path");
const fs = require("fs");
const { exec, spawnSync } = require("child_process");
const solc = require("solc");
const pipeline = require("util").promisify(require("stream").pipeline);
const { Blob } = require("buffer");

/**
 * Fetches a resource with an exponential timeout.
 * 1) Send req, wait backoff * 2^0 ms, abort if doesn't resolve
 * 2) Send req, wait backoff * 2^1 ms, abort if doesn't resolve
 * 3) Send req, wait backoff * 2^2 ms, abort if doesn't resolve...
 * ...
 * ...
 */
export async function fetchWithBackoff(resource, backoff = 10000, retries = 4) {
  let timeout = backoff;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => {
        controller.abort();
      }, timeout);
      const response = await fetch(resource, {
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      if (attempt === retries) {
        console.error("Failed fetchWithBackoff", {
          resource,
          attempt,
          retries,
          timeout,
          error,
        });
        throw new Error(`Failed fetching ${resource}: ${error}`);
      } else {
        timeout *= 2; // exponential backoff
        continue;
      }
    }
  }
  throw new Error(`Failed fetching ${resource}`);
}

const HOST_SOLC_REPO = " https://binaries.soliditylang.org/";

function findSolcPlatform() {
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

async function useSolidityCompiler(
  version,
  solcJsonInput,
  forceEmscripten = false,
) {
  // For nightly builds, Solidity version is saved as 0.8.17-ci.2022.8.9+commit.6b60524c instead of 0.8.17-nightly.2022.8.9+commit.6b60524c.
  // Not possible to retrieve compilers with "-ci.".
  if (version.includes("-ci.")) version = version.replace("-ci.", "-nightly.");
  const inputStringified = JSON.stringify(solcJsonInput);
  let compiled;

  const solcPlatform = findSolcPlatform();
  let solcPath;
  if (solcPlatform && !forceEmscripten) {
    solcPath = await getSolcExecutable(solcPlatform, version);
  }
  let startCompilation;
  if (solcPath && !forceEmscripten) {
    console.debug(`Compiling with solc binary ${version} at ${solcPath}`);
    startCompilation = Date.now();
    try {
      compiled = await asyncExecSolc(inputStringified, solcPath);
    } catch (error) {
      if (error?.code === "ENOBUFS") {
        throw new Error("Compilation output size too large");
      }
      console.warn(error.message);
      throw error;
    }
  } else {
    const solJson = await getSolcJs(version);
    startCompilation = Date.now();
    console.debug(`Compiling with solc-js ${version}`);
    if (solJson) {
      compiled = solJson.compile(inputStringified);
    }
  }

  const endCompilation = Date.now();
  console.info(`Compilation time : ${endCompilation - startCompilation} ms`);

  if (!compiled) {
    throw new Error("Compilation failed. No output from the compiler.");
  }
  const compiledJSON = JSON.parse(compiled);
  const errorMessages = compiledJSON?.errors?.filter(
    (e) => e.severity === "error",
  );
  if (errorMessages && errorMessages.length > 0) {
    const error = new Error(
      "Compiler error:\n " + JSON.stringify(errorMessages),
    );
    console.error(error.message);
    throw error;
  }
  return compiledJSON;
}

async function getAllMetadataAndSourcesFromSolcJson(solcJson, compilerVersion) {
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
  const compiled = await useSolidityCompiler(compilerVersion, solcJson);
  const metadataAndSources = [];
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
        buffer: Buffer.from(solcJson.sources[contractPath].content),
      });
    }
  }
  return metadataAndSources;
}

async function getSolcExecutable(platform, version) {
  const fileName = `solc-${platform}-v${version}`;
  const compilersPath = process.env.SOLC_REPO || path.join("/tmp", "solc-repo");
  const solcPath = path.join(compilersPath, fileName);
  if (fs.existsSync(solcPath) && validateSolcPath(solcPath)) {
    console.debug(
      `Found solc ${version} with platform ${platform} at ${solcPath}`,
    );
    return solcPath;
  }

  console.debug(
    `Downloading solc ${version} with platform ${platform} at ${solcPath}`,
  );
  const success = await fetchAndSaveSolc(platform, solcPath, version, fileName);
  console.debug(
    `Downloaded solc ${version} with platform ${platform} at ${solcPath}`,
  );
  if (success && !validateSolcPath(solcPath)) {
    console.error(`Cannot validate solc ${version}.`);
    return null;
  }
  return success ? solcPath : null;
}

function validateSolcPath(solcPath) {
  // TODO: Handle nodejs only dependencies
  const spawned = spawnSync(solcPath, ["--version"]);
  if (spawned.status === 0) {
    return true;
  }

  const error =
    spawned?.error?.message ||
    spawned.stderr.toString() ||
    "Error running solc, are you on the right platoform? (e.g. x64 vs arm)";

  console.warn(error);
  return false;
}

/**
 * Fetches a solc binary and saves it to the given path.
 *
 * If platform is "bin", it will download the solc-js binary.
 */
async function fetchAndSaveSolc(platform, solcPath, version, fileName) {
  const encodedURIFilename = encodeURIComponent(fileName);
  const githubSolcURI = `${HOST_SOLC_REPO}${platform}/${encodedURIFilename}`;
  console.debug(
    `Fetching solc ${version} on platform ${platform}: ${githubSolcURI}`,
  );
  let res = await fetchWithBackoff(githubSolcURI);
  let status = res.status;
  let buffer;

  // handle case in which the response is a link to another version
  if (status === 200) {
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

  if (status === 200 && buffer) {
    console.debug(
      `Fetched solc ${version} on platform ${platform}: ${githubSolcURI}`,
    );
    fs.mkdirSync(path.dirname(solcPath), { recursive: true });

    try {
      fs.unlinkSync(solcPath);
    } catch (_e) {
      undefined;
    }
    fs.writeFileSync(solcPath, new DataView(buffer), { mode: 0o755 });

    return true;
  } else {
    console.warn(`Failed fetching solc ${version}: ${githubSolcURI}`);
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
async function getSolcJs(version = "latest") {
  // /^\d+\.\d+\.\d+\+commit\.[a-f0-9]{8}$/
  version = version.trim();
  if (version !== "latest" && !version.startsWith("v")) {
    version = "v" + version;
  }

  const soljsonRepo = path.join("/tmp", "soljson-repo");
  const fileName = `soljson-${version}.js`;
  const soljsonPath = path.resolve(soljsonRepo, fileName);

  if (!fs.existsSync(soljsonPath)) {
    if (!(await fetchAndSaveSolc("bin", soljsonPath, version, fileName))) {
      return false;
    }
  }

  const solcjsImports = await import(soljsonPath);
  return solc.setupMethods(solcjsImports.default);
}

function asyncExecSolc(inputStringified, solcPath) {
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

function getOutputBlob(responseObject) {
  return new Blob([JSON.stringify(responseObject)]);
}

exports.handler = awslambda.streamifyResponse(
  async (event, responseStream, _context) => {
    let output;
    try {
      output = await useSolidityCompiler(
        event.version,
        event.solcJsonInput,
        event.forceEmscripten,
      );
    } catch (e) {
      output = { error: e.message };
    }
    console.debug("Compilation output: ", output);

    let outputBlob = getOutputBlob(output);

    // Handle AWS lambda's max stream response size of 20 MiB
    if (outputBlob.size > 20 * 2 ** 20) {
      console.error("Compilation output exceeded 20 MiB");
      output = { error: "Stream response limit exceeded" };
      outputBlob = getOutputBlob(output);
    }

    await pipeline(outputBlob.stream(), responseStream);
  },
);

/* exports
  .handler({
    version: "0.8.9+commit.e5eed63a",
    solcJsonInput: {
      language: "Solidity",
      sources: {
        "test.sol": {
          content: "contract C { function f() public  {} }",
        },
      },
      settings: {
        outputSelection: {
          "*": {
            "*": ["*"],
          },
        },
      },
    },
    forceEmscripten: false,
  })
  .then(console.log); */
