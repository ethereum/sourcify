import { id as keccak256str } from 'ethers';
import {
  AuxdataDiff,
  CompilableMetadata,
  CompiledContractCborAuxdata,
  CompilerOutput,
  InvalidSources,
  IpfsGateway,
  JsonInput,
  Libraries,
  Metadata,
  MetadataSourceMap,
  MissingSources,
  PathContent,
  RecompilationResult,
  StringMap,
} from './types';
import semver from 'semver';
import { fetchWithBackoff } from './utils';
import { storeByHash } from './validation';
import {
  decode as decodeBytecode,
  splitAuxdata,
} from '@ethereum-sourcify/bytecode-utils';
import { ipfsHash } from './hashFunctions/ipfsHash';
import { swarmBzzr0Hash, swarmBzzr1Hash } from './hashFunctions/swarmHash';
import { logError, logInfo, logSilly, logWarn } from './logger';
import { ISolidityCompiler } from './ISolidityCompiler';

// TODO: find a better place for these constants. Reminder: this sould work also in the browser
const IPFS_PREFIX = 'dweb:/ipfs/';
/**
 * Abstraction of a checked solidity contract. With metadata and source (solidity) files.
 */
export class CheckedContract {
  /** The solidity compiler used to compile the checked contract */
  solidityCompiler: ISolidityCompiler;
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
  name!: string;
  creationBytecode?: string;
  runtimeBytecode?: string;

  /** The raw string representation of the contract's metadata. Needed to generate a unique session id for the CheckedContract*/
  metadataRaw!: string;
  compilerOutput?: CompilerOutput;

  /** Marks the positions of the CborAuxdata parts in the bytecode */
  creationBytecodeCborAuxdata?: CompiledContractCborAuxdata;
  runtimeBytecodeCborAuxdata?: CompiledContractCborAuxdata;

  normalizedRuntimeBytecode?: string;
  normalizedCreationBytecode?: string;

  /** Checks whether this contract is valid or not.
   *  This is a static method due to persistence issues.
   *
   * @param contract the contract to be checked
   * @param ignoreMissing a flag indicating that missing sources should be ignored
   * @returns true if no sources are missing or are invalid (malformed); false otherwise
   */
  public static isValid(
    contract: CheckedContract,
    ignoreMissing = false,
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
    invalid: InvalidSources = {},
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
    runtimeBytecode: string,
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
      },
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
      'variation',
    );

    // We should canonicalize the metadata when we are generating "metadata variations" when we have a partial match.
    // It could be that the user somehow mixed the orderings of the metadata or added whitespaces etc.
    // For more information read https://github.com/ethereum/sourcify/issues/978
    const metadata: Metadata = reorderAlphabetically(
      JSON.parse(this.metadataRaw),
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
                },
              );
            }
          }
          return sources;
        },
        {},
      );

      if (decodedAuxdata?.ipfs) {
        const compiledMetadataIpfsCID = ipfsHash(JSON.stringify(metadata));
        if (decodedAuxdata?.ipfs === compiledMetadataIpfsCID) {
          return new CheckedContract(
            this.solidityCompiler,
            metadata,
            getSolidityFromPathContents(sources),
          );
        }
      }
      if (decodedAuxdata?.bzzr1) {
        const compiledMetadataBzzr1 = swarmBzzr1Hash(JSON.stringify(metadata));
        if (decodedAuxdata?.bzzr1 === compiledMetadataBzzr1) {
          return new CheckedContract(
            this.solidityCompiler,
            metadata,
            getSolidityFromPathContents(sources),
          );
        }
      }
      if (decodedAuxdata?.bzzr0) {
        const compiledMetadataBzzr0 = swarmBzzr0Hash(JSON.stringify(metadata));
        if (decodedAuxdata?.bzzr0 === compiledMetadataBzzr0) {
          return new CheckedContract(
            this.solidityCompiler,
            metadata,
            getSolidityFromPathContents(sources),
          );
        }
      }
    }
    return null;
  }

  /** Generates an edited contract with a space at the end of each source file to create a different source file hash and consequently a different metadata hash.
   * This differenence is then used to determine the positions of the auxdata in the raw bytecode.
   */
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
      (source) => (source.content += ' '),
    );
    return await this.solidityCompiler.compile(
      newCompilerSettings.version,
      newCompilerSettings.solcJsonInput,
      newCompilerSettings.forceEmscripten,
    );
  }

  /**
   * Finds the positions of the auxdata in the runtime and creation bytecodes.
   * Saves the CborAuxdata position (offset) and value in the runtime- and creationBytecodeCborAuxdata fields.
   *
   */
  public async generateCborAuxdataPositions(forceEmscripten = false) {
    if (
      this.creationBytecode === undefined ||
      this.runtimeBytecode === undefined
    ) {
      return false;
    }

    if (this.compilerOutput === undefined) {
      return false;
    }

    // Auxdata array extracted from the compiler's `legacyAssembly` field
    const auxdatasFromCompilerOutput = findAuxdatasInLegacyAssembly(
      this.compilerOutput.contracts[this.compiledPath][this.name].evm
        .legacyAssembly,
    );

    // Case: there is not auxadata
    if (auxdatasFromCompilerOutput.length === 0) {
      this.creationBytecodeCborAuxdata = {};
      this.runtimeBytecodeCborAuxdata = {};
      return true;
    }

    // Case: there is only one auxdata, no need to recompile
    if (auxdatasFromCompilerOutput.length === 1) {
      // Extract the auxdata from the end of the recompiled runtime bytecode
      const [, runtimeAuxdataCbor, runtimeCborLenghtHex] = splitAuxdata(
        this.runtimeBytecode,
      );

      const auxdataFromRawRuntimeBytecode = `${runtimeAuxdataCbor}${runtimeCborLenghtHex}`;

      // For some reason the auxdata from raw bytecode differs from the legacyAssembly's auxdata
      if (auxdatasFromCompilerOutput[0] !== auxdataFromRawRuntimeBytecode) {
        logWarn(
          "The auxdata from raw bytecode differs from the legacyAssembly's auxdata",
          {
            name: this.name,
          },
        );
        return false;
      }

      // we divide by 2 because we store the length in bytes (without 0x)
      this.runtimeBytecodeCborAuxdata = {
        '1': {
          offset:
            this.runtimeBytecode.substring(2).length / 2 -
            parseInt(runtimeCborLenghtHex, 16) -
            2,
          value: `0x${auxdataFromRawRuntimeBytecode}`,
        },
      };

      // Try to extract the auxdata from the end of the recompiled creation bytecode
      const [, creationAuxdataCbor, creationCborLenghtHex] = splitAuxdata(
        this.creationBytecode,
      );

      // If we can find the auxdata at the end of the bytecode return; otherwise continue with `generateEditedContract`
      if (creationAuxdataCbor) {
        const auxdataFromRawCreationBytecode = `${creationAuxdataCbor}${creationCborLenghtHex}`;
        if (auxdatasFromCompilerOutput[0] === auxdataFromRawCreationBytecode) {
          // we divide by 2 because we store the length in bytes (without 0x)
          this.creationBytecodeCborAuxdata = {
            '1': {
              offset:
                this.creationBytecode.substring(2).length / 2 -
                parseInt(creationCborLenghtHex, 16) -
                2,
              value: `0x${auxdataFromRawCreationBytecode}`,
            },
          };
          return true;
        } else {
          logWarn(
            "The creation auxdata from raw bytecode differs from the legacyAssembly's auxdata",
            { name: this.name },
          );
        }
      }
    }

    // Case: multiple auxdatas or failing creation auxdata,
    // we need to recompile with a slightly edited file to check the differences
    const editedContractCompilerOutput = await this.generateEditedContract({
      version: this.metadata.compiler.version,
      solcJsonInput: this.solcJsonInput,
      forceEmscripten,
    });
    const editedContract =
      editedContractCompilerOutput?.contracts[this.compiledPath][this.name];

    const editedContractAuxdatasFromCompilerOutput =
      findAuxdatasInLegacyAssembly(editedContract.evm.legacyAssembly);

    // Potentially we already found runtimeBytecodeCborAuxdata in the case of failing creation auxdata
    // so no need to call `findAuxdataPositions`
    if (this.runtimeBytecodeCborAuxdata === undefined) {
      this.runtimeBytecodeCborAuxdata = findAuxdataPositions(
        this.runtimeBytecode,
        `0x${editedContract?.evm?.deployedBytecode?.object}`,
        auxdatasFromCompilerOutput,
        editedContractAuxdatasFromCompilerOutput,
      );
    }

    this.creationBytecodeCborAuxdata = findAuxdataPositions(
      this.creationBytecode,
      `0x${editedContract?.evm.bytecode.object}`,
      auxdatasFromCompilerOutput,
      editedContractAuxdatasFromCompilerOutput,
    );

    return true;
  }

  public async recompile(
    forceEmscripten = false,
  ): Promise<RecompilationResult> {
    if (!CheckedContract.isValid(this)) {
      await CheckedContract.fetchMissing(this);
    }

    const version = this.metadata.compiler.version;

    const compilationStartTime = Date.now();
    logInfo('Compiling contract', {
      version,
      contract: this.name,
      path: this.compiledPath,
      forceEmscripten,
    });
    logSilly('Compilation input', { solcJsonInput: this.solcJsonInput });
    this.compilerOutput = await this.solidityCompiler.compile(
      version,
      this.solcJsonInput,
      forceEmscripten,
    );
    if (this.compilerOutput === undefined) {
      const error = new Error('Compiler error');
      logWarn('Compiler error', {
        errorMessages: ['compilerOutput is undefined'],
      });
      throw error;
    }

    const compilationEndTime = Date.now();
    const compilationDuration = compilationEndTime - compilationStartTime;
    logSilly('Compilation output', { compilerOutput: this.compilerOutput });
    logInfo('Compiled contract', {
      version,
      contract: this.name,
      path: this.compiledPath,
      forceEmscripten,
      compilationDuration: `${compilationDuration}ms`,
    });

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
      logWarn('Compiler error', {
        errorMessages,
      });
      throw error;
    }

    const contract =
      this.compilerOutput.contracts[this.compiledPath][this.name];

    this.creationBytecode = `0x${contract.evm.bytecode.object}`;
    this.runtimeBytecode = `0x${contract.evm?.deployedBytecode?.object}`;

    // Store the metadata from the compiler output and replace the initial user provided one.
    // Because the compiler output metadata is the one corresponding to the CBOR auxdata and the user might have provided a modified one e.g. the userdoc,abi fields modified which don't affect the compilation.
    this.metadataRaw = '{}';
    this.metadata = JSON.parse(this.metadataRaw);

    return {
      creationBytecode: this.creationBytecode.replace('0x', ''),
      runtimeBytecode: this.runtimeBytecode.replace('0x', ''),
      metadata: this.metadataRaw,
      // Sometimes the compiler returns empty object (not falsey). Convert it to undefined (falsey).
      immutableReferences:
        contract.evm?.deployedBytecode?.immutableReferences || {},
      creationLinkReferences: contract?.evm?.bytecode?.linkReferences || {},
      runtimeLinkReferences:
        contract?.evm?.deployedBytecode?.linkReferences || {},
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
            const ipfsGateway = getIpfsGateway();
            const ipfsUrl = ipfsGateway.url + ipfsCode;
            retrievedContent = await performFetch(
              ipfsUrl,
              hash,
              fileName,
              ipfsGateway.headers,
            );
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
        `Resource missing; unsuccessful fetching: ${missingFiles.join(', ')}`,
      );
      throw error;
    }
  }

  // Function to export the minimum information to reconstruct the CheckedContract
  exportConstructorArguments() {
    return {
      metadata: this.metadata,
      solidity: this.solidity,
      missing: this.missing,
      invalid: this.invalid,
      // creationBytecode: this.creationBytecode, // Not needed without create2
      compiledPath: this.compiledPath,
      name: this.name,
    };
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
  fileName?: string,
  headers: HeadersInit = {},
): Promise<string | null> {
  logInfo('Fetching file', {
    url,
    hash,
    fileName,
  });
  const res = await fetchWithBackoff(url, headers).catch((err) => {
    logError(err);
  });

  if (res) {
    if (res.status === 200) {
      const content = await res.text();
      if (hash && keccak256str(content) !== hash) {
        logError("The calculated and the provided hash don't match.");
        return null;
      }

      logInfo('Fetched the file', {
        fileName,
        url,
        hash,
      });
      return content;
    } else {
      logError('Failed to fetch the file', {
        url,
        hash,
        fileName,
        status: res.status,
      });
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
  sources: StringMap,
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
      'createJsonInputFromMetadata: Invalid compilationTarget',
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
    semver.eq(version, coercedVersion || ''),
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
    // 'abi',
    // 'devdoc',
    // 'userdoc',
    // // 'storageLayout',
    // 'evm.legacyAssembly',
    // 'evm.bytecode.object',
    // 'evm.bytecode.sourceMap',
    // // 'evm.bytecode.linkReferences',
    // // 'evm.bytecode.generatedSources',
    // 'evm.deployedBytecode.object',
    // 'evm.deployedBytecode.sourceMap',
    // 'evm.deployedBytecode.linkReferences',
    // 'evm.deployedBytecode.immutableReferences',
    // 'metadata',
    'abi',
    'ast',
    'interface',
    'ir',
    'userdoc',
    'devdoc',
    'evm.bytecode.object',
    'evm.bytecode.opcodes',
    'evm.deployedBytecode.object',
    'evm.deployedBytecode.opcodes',
    'evm.deployedBytecode.sourceMap',
    'evm.deployedBytecode.sourceMapFull',
    'evm.methodIdentifiers',
  ];

  // Convert the libraries from the metadata format to the compiler_settings format
  // metadata format: "contracts/1_Storage.sol:Journal": "0x7d53f102f4d4aa014db4e10d6deec2009b3cda6b"
  // settings format: "contracts/1_Storage.sol": { Journal: "0x7d53f102f4d4aa014db4e10d6deec2009b3cda6b" }
  const metadataLibraries = metadata.settings?.libraries || {};
  solcJsonInput.settings.libraries = Object.keys(
    metadataLibraries || {},
  ).reduce((libraries, libraryKey) => {
    // Before Solidity v0.7.5: { "ERC20": "0x..."}
    if (!libraryKey.includes(':')) {
      if (!libraries['']) {
        libraries[''] = {};
      }
      // try using the global method, available for pre 0.7.5 versions
      libraries[''][libraryKey] = metadataLibraries[libraryKey];
      return libraries;
    }

    // After Solidity v0.7.5: { "ERC20.sol:ERC20": "0x..."}
    const [contractPath, contractName] = libraryKey.split(':');
    if (!libraries[contractPath]) {
      libraries[contractPath] = {};
    }
    libraries[contractPath][contractName] = metadataLibraries[libraryKey];
    return libraries;
  }, {} as Libraries);

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
export function getIpfsGateway(): IpfsGateway {
  let ipfsGatewaysHeaders;
  if (process.env.IPFS_GATEWAY_HEADERS) {
    try {
      ipfsGatewaysHeaders = JSON.parse(process.env.IPFS_GATEWAY_HEADERS);
    } catch (error) {
      logError('Error while parsing IPFS_GATEWAY_HEADERS option', { error });
      throw new Error('Error while parsing IPFS_GATEWAY_HEADERS option');
    }
  }

  const ipfsGatewayUrl = process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs/';
  const urlWithTrailingSlash = ipfsGatewayUrl.endsWith('/')
    ? ipfsGatewayUrl
    : `${ipfsGatewayUrl}/`;

  return {
    url: urlWithTrailingSlash,
    headers: ipfsGatewaysHeaders,
  };
}

export const findContractPathFromContractName = (
  contracts: any,
  contractName: string,
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
  key: string,
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
  auxdatas: string[],
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
              auxdatas,
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

/**
 * Given two bytecodes, this function returns an array of ALL differing indexes.
 * @example getDiffPositions(['A', 'b', 'c', 'A', 'd'], ['A', 'x', 'y', 'A', 'z']) => [1, 2, 4]
 *
 */
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

/**
 *   Checks the raw bytecode indeed includes the auxdata diff at the given position
 */
function bytecodeIncludesAuxdataDiffAt(
  bytecode: string,
  auxdataDiff: AuxdataDiff,
  position: number,
): boolean {
  const { real, diffStart } = auxdataDiff;
  // the difference (i.e metadata hash) starts from "position". To get the whole auxdata instead of metadata go back "diffStart" and until + "real.length" of the auxdata.
  const extracted = bytecode.slice(
    position - diffStart,
    position - diffStart + real.length,
  );
  return extracted === real;
}

function getAuxdatasDiff(originalAuxdatas: string[], editedAuxdatas: string[]) {
  const auxdataDiffs: AuxdataDiff[] = [];
  for (let i = 0; i < originalAuxdatas.length; i++) {
    const diffPositions = getDiffPositions(
      originalAuxdatas[i],
      editedAuxdatas[i],
    );
    auxdataDiffs.push({
      real: originalAuxdatas[i],
      diffStart: diffPositions[0],
      diff: originalAuxdatas[i].substring(
        diffPositions[0],
        diffPositions[diffPositions.length - 1] + 1,
      ),
    });
  }
  return auxdataDiffs;
}

/**
 * Finds the positions of the auxdata in the bytecode.
 * The compiler outputs the auxdata values in the `legacyAssembly` field. However we can't use these values to do a simple string search on the compiled bytecode because an attacker can embed these values in the compiled contract code and cause the correspoding field in the onchain bytecode to be ignored falsely during verification.
 * A way to find the *metadata hashes* in the bytecode is to recompile the contract with a slightly edited source code and compare the differences in the raw bytecodes. However, this will only give us the positions of the metadata hashes in the bytecode. We need to find the positions of the whole *auxdata* in the bytecode.
 * So we go through each of the differences in the raw bytecode and check if an auxdata diff value from the legacyAssembly is included in that difference. If it is, we have found the position of the auxdata in the bytecode.
 */
function findAuxdataPositions(
  originalBytecode: string,
  editedBytecode: string,
  originalAuxdatas: string[],
  editedAuxdatas: string[],
): CompiledContractCborAuxdata {
  const auxdataDiffObjects = getAuxdatasDiff(originalAuxdatas, editedAuxdatas);

  const diffPositionsBytecodes = getDiffPositions(
    originalBytecode,
    editedBytecode,
  );
  const auxdataPositions: CompiledContractCborAuxdata = {};

  let prevDiffPosition = -99;
  for (const diffPosition of diffPositionsBytecodes) {
    // Don't check consecutive diffs like 55, 56, 57... , only if there's a gap like 55, 57, 58, then 78, 79, 80...
    if (prevDiffPosition + 1 === diffPosition) {
      prevDiffPosition = diffPosition;
      continue;
    }
    // New diff position
    for (const auxdataDiffIndex in auxdataDiffObjects) {
      const auxdataPositionsIndex = parseInt(auxdataDiffIndex) + 1;
      if (
        auxdataPositions[auxdataPositionsIndex] === undefined &&
        bytecodeIncludesAuxdataDiffAt(
          originalBytecode,
          auxdataDiffObjects[auxdataDiffIndex],
          diffPosition,
        )
      ) {
        auxdataPositions[auxdataPositionsIndex] = {
          offset:
            (diffPosition -
              auxdataDiffObjects[auxdataDiffIndex].diffStart -
              2) /
            2,
          value: `0x${auxdataDiffObjects[auxdataDiffIndex].real}`,
        };
      }
    }
    prevDiffPosition = diffPosition;
  }

  return auxdataPositions;
}
