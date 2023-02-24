import Web3 from 'web3';
import {
  CompilableMetadata,
  InvalidSources,
  JsonInput,
  Metadata,
  MissingSources,
  RecompilationResult,
  StringMap,
} from './types';
import semver from 'semver';
import { useCompiler } from './solidityCompiler';
import { fetchWithTimeout } from './utils';

// TODO: find a better place for these constants. Reminder: this sould work also in the browser
const IPFS_PREFIX = 'dweb:/ipfs/';
export const IPFS_GATEWAY = process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs/';
const FETCH_TIMEOUT = parseInt(process.env.FETCH_TIMEOUT || '') || 3000; // ms
/**
 * Abstraction of a checked solidity contract. With metadata and source (solidity) files.
 */
export class CheckedContract {
  /** Object containing contract metadata keys and values. */
  metadata: Metadata;

  /** SourceMap mapping the original compilation path to PathContent. */
  solidity: StringMap;

  /** Object containing the information about missing source files. */
  missing: MissingSources;

  /** Contains the invalid source files. */
  invalid: InvalidSources;

  /** Object containing input for solc when used with the --standard-json flag. */
  solcJsonInput: any;

  /** The path of the contract during compile-time. */
  compiledPath: string;

  /** The version of the Solidity compiler to use for compilation. */
  compilerVersion: string;

  /** The name of the contract. */
  name: string;

  /** The bytecodes of the contract. */
  creationBytecode?: string;

  /** The raw string representation of the contract's metadata. Needed to generate a unique session id for the CheckedContract*/
  metadataRaw: string;

  /** Checks whether this contract is valid or not.
   *  This is a static method due to persistence issues.
   *
   * @param contract the contract to be checked
   * @param ignoreMissing a flag indicating that missing sources should be ignored
   * @returns true if no sources are missing or are invalid (malformed); false otherwise
   */
  public static isValid(
    contract: CheckedContract,
    ignoreMissing = false
  ): boolean {
    return (
      (isEmpty(contract.missing) || ignoreMissing) && isEmpty(contract.invalid)
    );
  }

  public constructor(
    metadata: Metadata,
    solidity: StringMap,
    missing: MissingSources = {},
    invalid: InvalidSources = {}
  ) {
    this.metadataRaw = JSON.stringify(metadata);
    this.metadata = JSON.parse(JSON.stringify(metadata));
    this.solidity = solidity;
    this.missing = missing;
    this.invalid = invalid;

    if (metadata.compiler && metadata.compiler.version) {
      this.compilerVersion = metadata.compiler.version;
    } else {
      throw new Error('No compiler version found in metadata');
    }

    const { solcJsonInput, contractPath, contractName } =
      createJsonInputFromMetadata(metadata, solidity);

    this.solcJsonInput = solcJsonInput;
    this.compiledPath = contractPath;
    this.name = contractName;
  }

  public async recompile(): Promise<RecompilationResult> {
    if (!CheckedContract.isValid(this)) {
      await CheckedContract.fetchMissing(this);
    }

    const version = this.metadata.compiler.version;

    const output = await useCompiler(version, this.solcJsonInput);
    if (
      !output.contracts ||
      !output.contracts[this.compiledPath] ||
      !output.contracts[this.compiledPath][this.name] ||
      !output.contracts[this.compiledPath][this.name].evm ||
      !output.contracts[this.compiledPath][this.name].evm.bytecode
    ) {
      const errorMessages = output.errors
        .filter((e: any) => e.severity === 'error')
        .map((e: any) => e.formattedMessage);

      const error = new Error('Compiler error');
      console.error(errorMessages);
      throw error;
    }

    const contract: any = output.contracts[this.compiledPath][this.name];
    return {
      creationBytecode: `0x${contract.evm.bytecode.object}`,
      deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
      metadata: contract.metadata.trim(),
    };
  }

  /**
   * Asynchronously attempts to fetch the missing sources of this contract. An error is thrown in case of a failure.
   *
   * @param log log object
   */
  public static async fetchMissing(contract: CheckedContract): Promise<void> {
    const retrieved: StringMap = {};
    const missingFiles: string[] = [];
    for (const fileName in contract.missing) {
      const file = contract.missing[fileName];
      const hash = contract.missing[fileName].keccak256;

      let retrievedContent = null;

      const githubUrl = getGithubUrl(fileName);
      if (githubUrl) {
        retrievedContent = await performFetch(githubUrl, hash, fileName);
      } else {
        for (const url of file.urls) {
          if (url.startsWith(IPFS_PREFIX)) {
            const ipfsCode = url.slice(IPFS_PREFIX.length);
            const ipfsUrl = IPFS_GATEWAY + ipfsCode;
            retrievedContent = await performFetch(ipfsUrl, hash, fileName);
            if (retrievedContent) {
              break;
            }
          }
        }
      }

      if (retrievedContent) {
        retrieved[fileName] = retrievedContent;
      } else {
        missingFiles.push(fileName);
        break; // makes an early exit
      }
    }

    for (const fileName in retrieved) {
      delete contract.missing[fileName];
      contract.solidity[fileName] = retrieved[fileName];
    }

    const { solcJsonInput, contractPath, contractName } =
      createJsonInputFromMetadata(contract.metadata, contract.solidity);

    contract.solcJsonInput = solcJsonInput;
    contract.compiledPath = contractPath;
    contract.name = contractName;

    if (missingFiles.length) {
      const error = new Error(
        `Resource missing; unsuccessful fetching: ${missingFiles.join(', ')}`
      );
      throw error;
    }
  }
}

/**
 * Performs fetch and, if provided an hash, compares with the file's the provided one.
 *
 * @param url the url to be used as the file source
 * @param hash the hash of the file to be fetched; used for later comparison
 * @param fileName the name of the file; used for logging
 * @param log whether or not to log
 * @returns the fetched file if found; null otherwise
 */
export async function performFetch(
  url: string,
  hash?: string,
  fileName?: string
): Promise<string | null> {
  const res = await fetchWithTimeout(url, { timeout: FETCH_TIMEOUT }).catch(
    (err) => {
      console.log("Couldn't fetch: " + url + ' ' + hash + ' ' + fileName);
      console.log(err);
    }
  );

  if (res && res.status === 200) {
    const content = await res.text();
    if (hash && Web3.utils.keccak256(content) !== hash) {
      console.log("The calculated and the provided hash don't match.");
      return null;
    }

    console.log('Performing fetch: ' + url + ' ' + hash + ' ' + fileName);
    return content;
  } else {
    return null;
  }
}

/**
 * Makes a GitHub-compatible url out of the provided url, if possible.
 *
 * @param url
 * @returns a GitHub-compatible url if possible; null otherwise
 */
function getGithubUrl(url: string): string | null {
  if (!url.includes('github.com')) {
    return null;
  }
  return url
    .replace('github.com', 'raw.githubusercontent.com')
    .replace('/blob/', '/');
}

/**
 * Checks whether the provided object contains any keys or not.
 * @param obj The object whose emptiness is tested.
 * @returns true if any keys present; false otherwise
 */
export function isEmpty(obj: object): boolean {
  return !Object.keys(obj).length && obj.constructor === Object;
}

/**
 * Formats metadata into an object which can be passed to solc for recompilation
 * @param  {any}                 metadata solc metadata object
 * @param  {string[]}            sources  solidity sources
 * @return {ReformattedMetadata}
 */
function createJsonInputFromMetadata(
  metadata: Metadata,
  sources: StringMap
): CompilableMetadata {
  const solcJsonInput: Partial<JsonInput> = {};
  let contractPath = '';
  let contractName = '';

  solcJsonInput.settings = JSON.parse(JSON.stringify(metadata.settings));

  if (
    !metadata.settings ||
    !metadata.settings.compilationTarget ||
    Object.keys(metadata.settings.compilationTarget).length != 1
  ) {
    const error = new Error(
      'createJsonInputFromMetadata: Invalid compilationTarget'
    );
    throw error;
  }

  for (contractPath in metadata.settings.compilationTarget) {
    contractName = metadata.settings.compilationTarget[contractPath];
  }

  delete solcJsonInput?.settings?.compilationTarget;

  // Check inliner bug for below versions https://github.com/ethereum/sourcify/issues/640
  const versions = ['0.8.2', '0.8.3', '0.8.4'];
  const coercedVersion = semver.coerce(metadata.compiler.version)?.version;

  const affectedVersions = versions.filter((version) =>
    semver.eq(version, coercedVersion || '')
  );
  if (affectedVersions.length > 0) {
    if (solcJsonInput.settings?.optimizer?.details?.inliner) {
      delete solcJsonInput.settings.optimizer.details.inliner;
    }
  }

  solcJsonInput.sources = {};
  for (const source in sources) {
    solcJsonInput.sources[source] = { content: sources[source] };
  }

  solcJsonInput.language = metadata.language;
  solcJsonInput.settings = {
    ...solcJsonInput.settings,
    outputSelection: solcJsonInput?.settings?.outputSelection || {},
    metadata: solcJsonInput?.settings?.metadata || {},
  };

  solcJsonInput.settings.outputSelection['*'] =
    solcJsonInput.settings.outputSelection['*'] || {};

  solcJsonInput.settings.outputSelection['*'][contractName] = [
    'evm.bytecode.object',
    'evm.deployedBytecode.object',
    'metadata',
  ];

  solcJsonInput.settings.libraries = { '': metadata.settings.libraries || {} };

  return {
    solcJsonInput: solcJsonInput as JsonInput,
    contractPath,
    contractName,
  };
}
