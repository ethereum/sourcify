import { id as keccak256str } from 'ethers';
import {
  CompilableMetadata,
  CompiledContractArtifacts,
  CompiledContractArtifactsCborAuxdata,
  CompilerOutput,
  InvalidSources,
  JsonInput,
  Metadata,
  MetadataSourceMap,
  MissingSources,
  PathContent,
  RecompilationResult,
  StringMap,
} from './types';
import semver from 'semver';
import { fetchWithTimeout } from './utils';
import { storeByHash } from './validation';
import { decode as decodeBytecode } from '@ethereum-sourcify/bytecode-utils';
import { ipfsHash } from './hashFunctions/ipfsHash';
import { swarmBzzr0Hash, swarmBzzr1Hash } from './hashFunctions/swarmHash';
import { logError, logInfo, logWarn } from './logger';
import { ISolidityCompiler } from './ISolidityCompiler';

// TODO: find a better place for these constants. Reminder: this sould work also in the browser
const IPFS_PREFIX = 'dweb:/ipfs/';
const FETCH_TIMEOUT = parseInt(process.env.FETCH_TIMEOUT || '') || 3000; // ms
/**
 * Abstraction of a checked solidity contract. With metadata and source (solidity) files.
 */
export class CheckedContract {
  /** The solidity compiler used to compile the checked contract */
  solidityCompiler: ISolidityCompiler;

  /** Object containing contract metadata keys and values. */
  metadata!: Metadata;

  /** SourceMap mapping the original compilation path to PathContent. */
  solidity!: StringMap;

  /** Object containing the information about missing source files. */
  missing: MissingSources;

  /** Contains the invalid source files. */
  invalid: InvalidSources;

  /** Object containing input for solc when used with the --standard-json flag. */
  solcJsonInput: any;

  /** The path of the contract during compile-time. */
  compiledPath!: string;

  /** The version of the Solidity compiler to use for compilation. */
  compilerVersion!: string;

  /** The name of the contract. */
  name!: string;

  /** The bytecodes of the contract. */
  creationBytecode?: string;
  runtimeBytecode?: string;

  /** The raw string representation of the contract's metadata. Needed to generate a unique session id for the CheckedContract*/
  metadataRaw!: string;

  /** The compiler output */
  compilerOutput?: CompilerOutput;

  //** Artifacts */
  artifacts?: CompiledContractArtifacts;

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

  initSolcJsonInput(metadata: Metadata, solidity: StringMap) {
    this.metadataRaw = JSON.stringify(metadata);
    this.metadata = JSON.parse(JSON.stringify(metadata));
    this.solidity = solidity;

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

  public constructor(
    solidityCompiler: ISolidityCompiler,
    metadata: Metadata,
    solidity: StringMap,
    missing: MissingSources = {},
    invalid: InvalidSources = {}
  ) {
    this.solidityCompiler = solidityCompiler;
    this.missing = missing;
    this.invalid = invalid;
    this.initSolcJsonInput(metadata, solidity);
  }

  /**
   * Function to try to generate variations of the metadata of the contract such that it will match to the hash in the onchain bytecode.
   * Generates variations of the given source files and replaces the hashes in the metadata with the hashes of the variations.
   * If found, replaces this.metadata and this.solidity with the found variations.
   * Useful for finding perfect matches for known types of variations such as different line endings.
   *
   * @param runtimeBytecode
   * @returns the perfectly matching CheckedContract or null otherwise
   */
  async tryToFindPerfectMetadata(
    runtimeBytecode: string
  ): Promise<CheckedContract | null> {
    let decodedAuxdata;
    try {
      decodedAuxdata = decodeBytecode(runtimeBytecode);
    } catch (err) {
      // There is no auxdata at all in this contract
      return null;
    }

    const pathContent: PathContent[] = Object.keys(this.solidity).map(
      (path) => {
        return {
          path,
          content: this.solidity[path] || '',
        };
      }
    );

    const byHash = storeByHash(pathContent);

    /*
     * storeByHash returns a mapping like this one:
     * Map({
     *   keccak256str(variation.content): {
     *     content,
     *     path: pathContent.path,
     *     variation: contentVariator + '.' + endingVariator,
     *   }
     * })
     *
     * we need to group all the different files by variation:
     *
     * {
     *   "1.1": [
     *     {
     *       content,
     *       path: pathContent.path,
     *       variation: "1.1",
     *     },
     *     ...
     *   ],
     *   "1.2": [...]
     * }
     */
    const byVariation = groupBy(
      // the second parameter of Array.from is needed to pass to the groupBy function
      // an array of all the values of the the mapping, othwerise [key,value] is passed
      Array.from(byHash, ([, value]) => value),
      'variation'
    );

    // We should canonicalize the metadata when we are generating "metadata variations" when we have a partial match.
    // It could be that the user somehow mixed the orderings of the metadata or added whitespaces etc.
    // For more information read https://github.com/ethereum/sourcify/issues/978
    const metadata: Metadata = reorderAlphabetically(
      JSON.parse(this.metadataRaw)
    ) as Metadata;

    // For each variation
    // 1. replace: "keccak256" and "url" fields in the metadata with the hashes of the variation
    // 2. take the hash of the modified metadata
    // 3. Check if this will match the hash in the bytecode
    for (const sources of Object.values(byVariation)) {
      metadata.sources = sources.reduce(
        (sources: MetadataSourceMap, source) => {
          if (metadata.sources[source.path]) {
            sources[source.path] = metadata.sources[source.path];
            sources[source.path].keccak256 = keccak256str(source.content);
            if (sources[source.path].content) {
              sources[source.path].content = source.content;
            }
            if (sources[source.path].urls) {
              sources[source.path].urls = sources[source.path].urls?.map(
                (url: string) => {
                  if (url.includes('dweb:/ipfs/')) {
                    return `dweb:/ipfs/${ipfsHash(source.content)}`;
                  }
                  if (url.includes('bzz-raw://')) {
                    // Here swarmBzzr1Hash is always used
                    // https://github.com/ethereum/solidity/blob/eb2f874eac0aa871236bf5ff04b7937c49809c33/libsolidity/interface/CompilerStack.cpp#L1549
                    return `bzz-raw://${swarmBzzr1Hash(source.content)}`;
                  }
                  return '';
                }
              );
            }
          }
          return sources;
        },
        {}
      );

      if (decodedAuxdata?.ipfs) {
        const compiledMetadataIpfsCID = ipfsHash(JSON.stringify(metadata));
        if (decodedAuxdata?.ipfs === compiledMetadataIpfsCID) {
          return new CheckedContract(
            this.solidityCompiler,
            metadata,
            getSolidityFromPathContents(sources)
          );
        }
      }
      if (decodedAuxdata?.bzzr1) {
        const compiledMetadataBzzr1 = swarmBzzr1Hash(JSON.stringify(metadata));
        if (decodedAuxdata?.bzzr1 === compiledMetadataBzzr1) {
          return new CheckedContract(
            this.solidityCompiler,
            metadata,
            getSolidityFromPathContents(sources)
          );
        }
      }
      if (decodedAuxdata?.bzzr0) {
        const compiledMetadataBzzr0 = swarmBzzr0Hash(JSON.stringify(metadata));
        if (decodedAuxdata?.bzzr0 === compiledMetadataBzzr0) {
          return new CheckedContract(
            this.solidityCompiler,
            metadata,
            getSolidityFromPathContents(sources)
          );
        }
      }
    }
    return null;
  }

  public async generateEditedContract(compilerSettings: {
    version: string;
    solcJsonInput: JsonInput;
    forceEmscripten: boolean;
  }) {
    const newCompilerSettings: {
      version: string;
      solcJsonInput: JsonInput;
      forceEmscripten: boolean;
    } = JSON.parse(JSON.stringify(compilerSettings));
    Object.values(newCompilerSettings.solcJsonInput.sources).forEach(
      (source) => (source.content += ' ')
    );
    return await this.solidityCompiler.compile(
      newCompilerSettings.version,
      newCompilerSettings.solcJsonInput,
      newCompilerSettings.forceEmscripten
    );
  }

  public async generateArtifacts(forceEmscripten = false) {
    if (
      this.creationBytecode === undefined ||
      this.runtimeBytecode === undefined
    ) {
      return false;
    }

    if (this.compilerOutput === undefined) {
      return false;
    }

    const editedContractCompilerOutput = await this.generateEditedContract({
      version: this.metadata.compiler.version,
      solcJsonInput: this.solcJsonInput,
      forceEmscripten,
    });
    const editedContract =
      editedContractCompilerOutput?.contracts[this.compiledPath][this.name];

    const originalAuxdatasList = findAuxdatasInLegacyAssembly(
      this.compilerOutput.contracts[this.compiledPath][this.name].evm
        .legacyAssembly
    );

    const editedAuxdatasList = findAuxdatasInLegacyAssembly(
      editedContract.evm.legacyAssembly
    );

    this.artifacts = {
      creationBytecodeCborAuxdata: findAuxdataPositions(
        this.creationBytecode,
        `0x${editedContract?.evm.bytecode.object}`,
        originalAuxdatasList,
        editedAuxdatasList
      ),
      runtimeBytecodeCborAuxdata: findAuxdataPositions(
        this.runtimeBytecode,
        `0x${editedContract?.evm?.deployedBytecode?.object}`,
        originalAuxdatasList,
        editedAuxdatasList
      ),
    };

    return true;
  }

  public async recompile(
    forceEmscripten = false
  ): Promise<RecompilationResult> {
    if (!CheckedContract.isValid(this)) {
      await CheckedContract.fetchMissing(this);
    }

    const version = this.metadata.compiler.version;

    this.compilerOutput = await this.solidityCompiler.compile(
      version,
      this.solcJsonInput,
      forceEmscripten
    );

    if (
      !this.compilerOutput.contracts ||
      !this.compilerOutput.contracts[this.compiledPath] ||
      !this.compilerOutput.contracts[this.compiledPath][this.name] ||
      !this.compilerOutput.contracts[this.compiledPath][this.name].evm ||
      !this.compilerOutput.contracts[this.compiledPath][this.name].evm.bytecode
    ) {
      const errorMessages =
        this.compilerOutput.errors
          ?.filter((e: any) => e.severity === 'error')
          .map((e: any) => e.formattedMessage) || [];

      const error = new Error('Compiler error');
      logWarn(
        `Compiler error in CheckedContract.recompile: \n${errorMessages.join(
          '\n\t'
        )}`
      );
      throw error;
    }

    const contract =
      this.compilerOutput.contracts[this.compiledPath][this.name];

    this.creationBytecode = `0x${contract.evm.bytecode.object}`;
    this.runtimeBytecode = `0x${contract.evm?.deployedBytecode?.object}`;

    return {
      creationBytecode: this.creationBytecode,
      runtimeBytecode: this.runtimeBytecode,
      metadata: contract.metadata.trim(),
      // Sometimes the compiler returns empty object (not falsey). Convert it to undefined (falsey).
      immutableReferences:
        contract.evm?.deployedBytecode?.immutableReferences &&
        Object.keys(contract.evm.deployedBytecode.immutableReferences).length >
          0
          ? contract.evm.deployedBytecode.immutableReferences
          : {},
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
            const ipfsUrl = getIpfsGateway() + ipfsCode;
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
  logInfo(`Fetching the file ${fileName} from ${url}...`);
  const res = await fetchWithTimeout(url, { timeout: FETCH_TIMEOUT }).catch(
    (err) => {
      if (err.type === 'aborted')
        logWarn(
          `Fetching the file ${fileName} from ${url} timed out. Timeout: ${FETCH_TIMEOUT}ms`
        );
      else logError(err);
    }
  );

  if (res) {
    if (res.status === 200) {
      const content = await res.text();
      if (hash && keccak256str(content) !== hash) {
        logError("The calculated and the provided hash don't match.");
        return null;
      }

      logInfo(`Successfully fetched the file ${fileName}`);
      return content;
    } else {
      logError(
        `Fetching the file ${fileName} failed with status: ${res?.status}`
      );
      return null;
    }
  }
  return null;
}

/**
 * Makes a GitHub-compatible url out of the provided url, if possible.
 *
 * @param url
 * @returns a GitHub-compatible url if possible; null otherwise
 */
export function getGithubUrl(url: string): string | null {
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

  solcJsonInput.settings.outputSelection['*']['*'] = [
    'abi',
    'devdoc',
    'userdoc',
    'storageLayout',
    // 'evm.legacyAssembly',
    'evm.bytecode.object',
    'evm.bytecode.sourceMap',
    'evm.bytecode.linkReferences',
    'evm.deployedBytecode.object',
    'evm.deployedBytecode.sourceMap',
    'evm.deployedBytecode.linkReferences',
    'evm.deployedBytecode.immutableReferences',
    'metadata',
  ];

  solcJsonInput.settings.libraries = { '': metadata.settings.libraries || {} };

  return {
    solcJsonInput: solcJsonInput as JsonInput,
    contractPath,
    contractName,
  };
}

/**
 * Because the gateway might change across tests, don't set it to a variable but look for env variable.
 * Otherwise fall back to the default ipfs.io.
 *
 * This will likely moved to server or somewhere else. But keep it here for now.
 */
export function getIpfsGateway(): string {
  return process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs/';
}

export const findContractPathFromContractName = (
  contracts: any,
  contractName: string
): string | null => {
  for (const key of Object.keys(contracts)) {
    const contractsList = contracts[key];
    if (Object.keys(contractsList).includes(contractName)) {
      return key;
    }
  }
  return null;
};

/**
 * The groupBy function is a function that takes an
 * array and a key as input,and returns an object containing
 * an index of the array elements grouped by the value of
 * the specified key.
 */
const groupBy = function <T extends { [index: string]: any }>(
  xs: T[],
  key: string
): { index?: T[] } {
  return xs.reduce(function (rv: { [index: string]: T[] }, x: T) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

const getSolidityFromPathContents = function (sources: PathContent[]) {
  return sources.reduce((sources: StringMap, source) => {
    sources[source.path] = source.content;
    return sources;
  }, {});
};

function reorderAlphabetically(obj: any): any {
  // Do not reorder arrays or other types
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return obj;
  }

  const ordered: any = {};

  Object.keys(obj)
    .sort((a, b) => a.localeCompare(b))
    .forEach((key: string) => {
      ordered[key] = reorderAlphabetically(obj[key]);
    });

  return ordered;
}

function getAuxdataInLegacyAssemblyBranch(
  legacyAssemblyBranch: any,
  auxdatas: string[]
) {
  if (typeof legacyAssemblyBranch === 'object') {
    Object.keys(legacyAssemblyBranch).forEach((key) => {
      switch (key) {
        case '.auxdata': {
          auxdatas.push(legacyAssemblyBranch[key]);
          break;
        }
        case '.code': {
          break;
        }
        default: {
          if (key === '.data' || Number.isInteger(Number(key))) {
            return getAuxdataInLegacyAssemblyBranch(
              legacyAssemblyBranch[key],
              auxdatas
            );
          }
        }
      }
    });
  }
}

function findAuxdatasInLegacyAssembly(legacyAssembly: any) {
  const auxdatas: string[] = [];
  getAuxdataInLegacyAssemblyBranch(legacyAssembly, auxdatas);
  return auxdatas;
}

// Given two bytecodes, this function returns an array of differing positions
function getDiffPositions(original: string, modified: string): number[] {
  const differences: number[] = [];
  const minLength = Math.min(original.length, modified.length);

  for (let i = 0; i < minLength; i++) {
    if (original[i] !== modified[i]) {
      differences.push(i);
    }
  }

  return differences;
}

// Checks if a substring exists in the bytecode at a given position
function bytecodeIncludesAuxdataDiffAt(
  bytecode: string,
  {
    real,
    diff,
    offsetStart,
    offsetEnd,
  }: { real: string; diff: string; offsetStart: number; offsetEnd: number },
  position: number
): boolean {
  const extracted = bytecode.substr(
    position - offsetStart,
    offsetStart + diff.length + offsetEnd
  );
  return extracted === real;
}

function getAuxdatasDiff(originalAuxdatas: string[], editedAuxdatas: string[]) {
  const auxdatasDiffs = [];
  for (let i = 0; i < originalAuxdatas.length; i++) {
    const diffPositions = getDiffPositions(
      originalAuxdatas[i],
      editedAuxdatas[i]
    );
    auxdatasDiffs.push({
      offsetStart: diffPositions[0],
      offsetEnd:
        originalAuxdatas[i].length -
        diffPositions[diffPositions.length - 1] -
        1,
      real: originalAuxdatas[i],
      diff: originalAuxdatas[i].substring(
        diffPositions[0],
        diffPositions[diffPositions.length - 1] + 1
      ),
    });
  }
  return auxdatasDiffs;
}

function findAuxdataPositions(
  originalBytecode: string,
  editedBytecode: string,
  originalAuxdatas: string[],
  editedAuxdatas: string[]
): CompiledContractArtifactsCborAuxdata {
  const auxdataDiffs = getAuxdatasDiff(originalAuxdatas, editedAuxdatas);

  const diffPositionsBytecodes = getDiffPositions(
    originalBytecode,
    editedBytecode
  );
  const auxdataPositions: CompiledContractArtifactsCborAuxdata = {};

  for (const offsetOfDiffInByteocde of diffPositionsBytecodes) {
    for (const auxdataDiffIndex in auxdataDiffs) {
      if (
        auxdataPositions[auxdataDiffIndex] === undefined &&
        bytecodeIncludesAuxdataDiffAt(
          originalBytecode,
          auxdataDiffs[auxdataDiffIndex],
          offsetOfDiffInByteocde
        )
      ) {
        auxdataPositions[auxdataDiffIndex] = {
          offset:
            offsetOfDiffInByteocde - auxdataDiffs[auxdataDiffIndex].offsetStart,
          value: auxdataDiffs[auxdataDiffIndex].real,
        };
      }
    }
  }

  return auxdataPositions;
}
