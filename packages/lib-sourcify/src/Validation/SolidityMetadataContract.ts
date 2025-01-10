import {
  InvalidSources,
  ISolidityCompiler,
  IVyperCompiler,
  Metadata,
  MissingSources,
  PathContent,
  StringMap,
  VyperJsonInput,
  JsonInput,
  Settings,
  Libraries,
} from '..';
import { id as keccak256str } from 'ethers';
import semver from 'semver';

const CONTENT_VARIATORS = [
  (content: string) => content,
  (content: string) => content.replace(/\r?\n/g, '\r\n'),
  (content: string) => content.replace(/\r\n/g, '\n'),
];

const ENDING_VARIATORS = [
  (content: string) => content,
  (content: string) => content.trimEnd(),
  (content: string) => content.trimEnd() + '\n',
  (content: string) => content.trimEnd() + '\r\n',
  (content: string) => content + '\n',
  (content: string) => content + '\r\n',
];

// Dummy Compilation class
class Compilation {
  compiler: ISolidityCompiler | IVyperCompiler;
  compilerVersion: string;
  compilationTarget: string;
  jsonInput: JsonInput | VyperJsonInput;
  constructor(
    compiler: ISolidityCompiler | IVyperCompiler,
    compilerVersion: string,
    compilationTarget: string,
    jsonInput: JsonInput | VyperJsonInput,
  ) {
    this.compiler = compiler;
    this.compilerVersion = compilerVersion;
    this.compilationTarget = compilationTarget;
    this.jsonInput = jsonInput;
  }
}

export class SolidityMetadataContract {
  metadata: Metadata;
  name: string;
  path: string;
  providedSources: PathContent[];
  providedSourcesByHash: Map<string, PathContent>;
  foundSources: StringMap;
  missingSources: MissingSources;
  invalidSources: InvalidSources;
  unusedSourceFiles: string[];
  metadata2provided: StringMap; // maps the file path as in metadata.sources to the path of the provided by the user. E.g. metadata can have "contracts/1_Storage.sol" but the user provided "/Users/user/project/contracts/1_Storage.sol"
  compilation: Compilation | null;
  solcJsonInput: JsonInput | null;

  constructor(metadata: Metadata, providedSources: PathContent[]) {
    this.metadata = metadata;
    // These are assigned in `assembleContract`
    this.foundSources = {};
    this.missingSources = {};
    this.invalidSources = {};
    this.unusedSourceFiles = [];
    this.metadata2provided = {};
    this.compilation = null;
    this.solcJsonInput = null;

    const compilationTargetPath = Object.keys(
      metadata.settings.compilationTarget,
    )[0];
    this.path = compilationTargetPath;
    this.name = metadata.settings.compilationTarget[compilationTargetPath];
    this.providedSources = providedSources;
    this.providedSourcesByHash = this.storeByHash(providedSources);
    this.assembleContract();
    if 
  }

  /**
   * Generates a map of files indexed by the keccak hash of their content.
   *
   * @param  {string[]}  files Array containing sources.
   * @returns Map object that maps hash to PathContent.
   */
  storeByHash(files: PathContent[]): Map<string, PathContent> {
    const byHash: Map<string, PathContent> = new Map();

    for (const pathContent of files) {
      for (const variation of this.generateVariations(pathContent)) {
        const calculatedHash = keccak256str(variation.content);
        byHash.set(calculatedHash, variation);
      }
    }

    return byHash;
  }

  /**
   * Assembles the contract by checking the sources in the metadata and finding them with the hash in the sourcesByHash map.
   * Marks missing sources and invalid sources.
   */
  private assembleContract() {
    for (const sourcePath in this.metadata.sources) {
      const sourceInfoFromMetadata = this.metadata.sources[sourcePath];
      let file: PathContent | undefined = undefined;
      const expectedHash: string = sourceInfoFromMetadata.keccak256;
      if (sourceInfoFromMetadata.content) {
        // Source content already in metadata
        file = {
          content: sourceInfoFromMetadata.content,
          path: sourcePath,
        };
        const contentHash = keccak256str(file.content);
        if (contentHash != expectedHash) {
          this.invalidSources[sourcePath] = {
            expectedHash: expectedHash,
            calculatedHash: contentHash,
            msg: `The keccak256 given in the metadata and the calculated keccak256 of the source content in metadata don't match`,
          };
          continue;
        }
      } else {
        // Get source from input files by hash
        const pathContent = this.providedSourcesByHash.get(expectedHash);
        if (pathContent) {
          file = pathContent;
          this.metadata2provided[sourcePath] = pathContent.path;
        } // else: no file has the hash that was searched for
      }

      if (file && file.content) {
        this.foundSources[sourcePath] = file.content;
      } else {
        this.missingSources[sourcePath] = {
          keccak256: expectedHash,
          urls: sourceInfoFromMetadata.urls!,
        };
      }
    }

    // Finally, extract unused source files
    const usedFilePaths = Object.values(this.metadata2provided);
    const usedFilesSet = new Set(usedFilePaths);
    this.unusedSourceFiles = this.providedSources
      .map((pc) => pc.path)
      .filter((file) => !usedFilesSet.has(file));
  }

  private generateVariations(pathContent: PathContent): PathContent[] {
    const variations: {
      content: string;
      contentVariator: number;
      endingVariator: number;
    }[] = [];
    const original = pathContent.content;
    for (const [
      CONTENT_VARIATORS_INDEX,
      contentVariator,
    ] of CONTENT_VARIATORS.entries()) {
      const variatedContent = contentVariator(original);
      for (const [
        ENDING_VARIATORS_INDEX,
        endingVariator,
      ] of ENDING_VARIATORS.entries()) {
        const variation = endingVariator(variatedContent);
        variations.push({
          content: variation,
          contentVariator: CONTENT_VARIATORS_INDEX,
          endingVariator: ENDING_VARIATORS_INDEX,
        });
      }
    }

    return variations.map(({ content, contentVariator, endingVariator }) => {
      return {
        content,
        path: pathContent.path,
        variation: contentVariator + '.' + endingVariator,
      };
    });
  }

  createJsonInputFromMetadata() {
    if (
      Object.keys(this.missingSources).length > 0 ||
      Object.keys(this.invalidSources).length > 0
    ) {
      throw new Error(
        `Can't create JsonInput from metadata: Missing or invalid sources in metadata: ${JSON.stringify(
          this.missingSources,
        )}`,
      );
    }

    this.solcJsonInput = {} as JsonInput;
    // Clone the settings object to avoid mutating the original metadata
    this.solcJsonInput.settings = JSON.parse(
      JSON.stringify(this.metadata.settings),
    ) as Settings;

    if (
      !this.metadata.settings ||
      !this.metadata.settings.compilationTarget ||
      Object.keys(this.metadata.settings.compilationTarget).length != 1
    ) {
      throw new Error(
        `Can't create JsonInput from metadata: Invalid compilationTarget in metadata: ${
          this.metadata?.settings?.compilationTarget
        }`,
      );
    }

    this.handleInlinerBug();
    // Standard JSON does not have compilationTarget, only in metadata.json
    delete this.solcJsonInput?.settings?.compilationTarget;

    this.solcJsonInput.sources = {};
    for (const source in this.metadata.sources) {
      this.solcJsonInput.sources[source] = {
        content: this.foundSources[source],
      };
    }

    this.solcJsonInput.language = this.metadata.language;

    this.solcJsonInput.settings.outputSelection = {};
    this.solcJsonInput.settings.outputSelection['*'] =
      this.solcJsonInput.settings.outputSelection['*'] || {};

    this.solcJsonInput.settings.outputSelection['*']['*'] = [
      'abi',
      'devdoc',
      'userdoc',
      'storageLayout',
      'evm.legacyAssembly',
      'evm.bytecode.object',
      'evm.bytecode.sourceMap',
      'evm.bytecode.linkReferences',
      'evm.bytecode.generatedSources',
      'evm.deployedBytecode.object',
      'evm.deployedBytecode.sourceMap',
      'evm.deployedBytecode.linkReferences',
      'evm.deployedBytecode.immutableReferences',
      'metadata',
    ];

    // Convert the libraries from the metadata format to the compiler_settings format
    // metadata format: "contracts/1_Storage.sol:Journal": "0x7d53f102f4d4aa014db4e10d6deec2009b3cda6b"
    // settings format: "contracts/1_Storage.sol": { Journal: "0x7d53f102f4d4aa014db4e10d6deec2009b3cda6b" }
    const metadataLibraries = this.metadata.settings?.libraries || {};
    this.solcJsonInput.settings.libraries = Object.keys(
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
  }

  handleInlinerBug() {
    // Check inliner bug for below versions https://github.com/ethereum/sourcify/issues/640
    const affectedVersions = ['0.8.2', '0.8.3', '0.8.4'];
    // Normalize the version e.g. 0.8.2+commit.6615895f -> 0.8.2
    const coercedVersion = semver.coerce(
      this.metadata.compiler.version,
    )?.version;

    const isAffected = affectedVersions.some((version) =>
      semver.eq(version, coercedVersion || ''),
    );
    if (isAffected) {
      if (this.solcJsonInput?.settings?.optimizer?.details?.inliner) {
        delete this.solcJsonInput.settings.optimizer.details.inliner;
      }
    }
  }
}
