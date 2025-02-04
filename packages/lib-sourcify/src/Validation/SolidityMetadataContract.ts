import { id as keccak256str } from 'ethers';
import semver from 'semver';
import { getIpfsGateway, performFetch } from './fetchUtils';
import { SolidityCompilation } from '../Compilation/SolidityCompilation';
import {
  ISolidityCompiler,
  Libraries,
  Settings,
  SolidityJsonInput,
} from '../Compilation/SolidityTypes';
import { Metadata, StringMap } from '../Compilation/CompilationTypes';
import { InvalidSources, MissingSources, PathContent } from './ValidationTypes';

const CONTENT_VARIATORS = [
  (content: string) => content.replace(/\r?\n/g, '\r\n'),
  (content: string) => content.replace(/\r\n/g, '\n'),
];

const ENDING_VARIATORS = [
  (content: string) => content.trimEnd(),
  (content: string) => content.trimEnd() + '\n',
  (content: string) => content.trimEnd() + '\r\n',
  (content: string) => content + '\n',
  (content: string) => content + '\r\n',
];

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
  metadataPathToProvidedFilePath: StringMap; // maps the file path as in metadata.sources to the path of the provided by the user. E.g. metadata can have "contracts/1_Storage.sol" but the user provided "/Users/user/project/contracts/1_Storage.sol"
  compilation: SolidityCompilation | null;
  solcJsonInput: SolidityJsonInput | null;

  constructor(metadata: Metadata, providedSources: PathContent[]) {
    this.metadata = metadata;
    // These are assigned in `assembleContract`
    this.foundSources = {};
    this.missingSources = {};
    this.invalidSources = {};
    this.unusedSourceFiles = [];
    this.metadataPathToProvidedFilePath = {};
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
    if (this.isCompilable()) {
      this.createJsonInputFromMetadata();
    }
  }

  async createCompilation(compiler: ISolidityCompiler) {
    if (Object.keys(this.missingSources).length > 0) {
      await this.fetchMissing();
    }

    this.createJsonInputFromMetadata();

    this.compilation = new SolidityCompilation(
      compiler,
      this.metadata.compiler.version,
      this.solcJsonInput!,
      {
        path: this.path,
        name: this.name,
      },
    );

    return this.compilation;
  }

  /**
   * Generates a map of files indexed by the keccak hash of their content.
   *
   */
  storeByHash(files: PathContent[]): Map<string, PathContent> {
    const byHash: Map<string, PathContent> = new Map();

    for (const pathContent of files) {
      const calculatedHash = keccak256str(pathContent.content);
      byHash.set(calculatedHash, pathContent);
    }

    return byHash;
  }

  generateSourceVariations() {
    for (const pathContent of this.providedSources) {
      const variations = this.generateVariations(pathContent);
      for (const variation of variations) {
        const calculatedHash = keccak256str(variation.content);
        this.providedSourcesByHash.set(calculatedHash, variation);
      }
    }
  }

  /**
   * Assembles the contract by checking the sources in the metadata and finding them with the hash in the sourcesByHash map.
   * First optimistically tries to find the source in the provided sources. If not all found, it will generate variations of source files and try again.
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
          this.metadataPathToProvidedFilePath[sourcePath] = pathContent.path;
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

    // If there are still missing sources, generate variations of the provided sources and try again. We optimistically tried to find the source in the provided sources first.
    if (Object.keys(this.missingSources).length > 0) {
      this.generateSourceVariations();
      for (const missingSource in this.missingSources) {
        const missingKeccak = this.missingSources[missingSource].keccak256;
        const pathContent = this.providedSourcesByHash.get(missingKeccak);
        if (pathContent) {
          this.foundSources[missingSource] = pathContent.content;
          this.metadataPathToProvidedFilePath[missingSource] = pathContent.path;
          delete this.missingSources[missingSource];
        }
      }
    }

    // Finally, extract unused source files
    const usedFilePaths = Object.values(this.metadataPathToProvidedFilePath);
    const usedFilesSet = new Set(usedFilePaths);
    this.unusedSourceFiles = this.providedSources
      .map((pc) => pc.path)
      .filter((file) => !usedFilesSet.has(file));
  }

  /**
   * Asynchronously attempts to fetch the missing sources of this contract. An error is thrown in case of a failure.
   *
   * @param log log object
   */
  async fetchMissing(): Promise<void> {
    const IPFS_PREFIX = 'dweb:/ipfs/';

    for (const fileName in this.missingSources) {
      const file = this.missingSources[fileName];
      const hash = file.keccak256;

      let retrievedContent = null;

      // Sometimes file paths are github urls, try to fetch from there
      if (fileName.includes('github.com')) {
        const githubUrl = fileName
          .replace('github.com', 'raw.githubusercontent.com')
          .replace('/blob/', '/');
        retrievedContent = await performFetch(githubUrl, hash, fileName);
      } else {
        for (const url of file.urls) {
          if (url.startsWith(IPFS_PREFIX)) {
            const ipfsCID = url.slice(IPFS_PREFIX.length);
            const ipfsGateway = getIpfsGateway();
            const ipfsUrl = ipfsGateway.url + ipfsCID;
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
        this.foundSources[fileName] = retrievedContent;
        delete this.missingSources[fileName];
      }
    }

    if (Object.keys(this.missingSources).length) {
      const error = new Error(
        `Resource missing; unsuccessful fetching: ${Object.keys(this.missingSources).join(', ')}`,
      );
      throw error;
    }

    this.createJsonInputFromMetadata();
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

    this.solcJsonInput = {} as SolidityJsonInput;
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
        `Can't create JsonInput from metadata: Invalid compilationTarget in metadata: ${Object.keys(
          this.metadata.settings.compilationTarget,
        ).join(',')}`,
      );
    }

    this.handleInlinerBug();
    // Standard JSON does not have compilationTarget, only in metadata.json
    delete this.solcJsonInput.settings.compilationTarget;

    this.solcJsonInput.sources = {};
    for (const source in this.metadata.sources) {
      this.solcJsonInput.sources[source] = {
        content: this.foundSources[source],
      };
    }

    this.solcJsonInput.language = this.metadata.language;

    // Convert the libraries from the metadata format to the compiler_settings format
    // metadata format: "contracts/1_Storage.sol:Journal": "0x7d53f102f4d4aa014db4e10d6deec2009b3cda6b"
    // settings format: "contracts/1_Storage.sol": { Journal: "0x7d53f102f4d4aa014db4e10d6deec2009b3cda6b" }
    const metadataLibraries = this.metadata.settings.libraries || {};
    this.solcJsonInput.settings.libraries = Object.keys(
      metadataLibraries,
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

  isCompilable() {
    return (
      Object.keys(this.missingSources).length === 0 &&
      Object.keys(this.invalidSources).length === 0
    );
  }
}
