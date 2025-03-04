// Tools to assemble SolidityMetadataContract(s) from files.

import { Metadata, StringMap } from '../Compilation/CompilationTypes';
import { SolidityCompilation } from '../Compilation/SolidityCompilation';
import { Sources, SolidityJsonInput } from '../Compilation/SolidityTypes';
import { logDebug, logInfo } from '../logger';
import { SolidityMetadataContract } from './SolidityMetadataContract';
import {
  InvalidSources,
  MissingSources,
  PathBuffer,
  PathContent,
} from './ValidationTypes';
import { unzipFiles } from './zipUtils';
import fs from 'fs';
import Path from 'path';
import { id as keccak256str } from 'ethers';

function pathContentArrayToStringMap(pathContentArr: PathContent[]) {
  const stringMapResult: StringMap = {};
  pathContentArr.forEach((elem, i) => {
    if (elem.path) {
      stringMapResult[elem.path] = elem.content;
    } else {
      stringMapResult[`path-${i}`] = elem.content;
    }
  });
  return stringMapResult;
}

function extractUnused(
  inputFiles: PathContent[],
  usedFiles: string[],
  unused: string[],
): void {
  const usedFilesSet = new Set(usedFiles);
  const tmpUnused = inputFiles
    .map((pc) => pc.path)
    .filter((file) => !usedFilesSet.has(file));
  unused.push(...tmpUnused);
}

/**
 * Regular expression matching metadata nested within another string.
 * Assumes metadata's first key is "compiler" and the last key is "version".
 * This is true for the metadata files generated by the compiler as it's canonicalized by sorting the keys.
 */
const NESTED_METADATA_REGEX =
  /"{\\"compiler\\":{\\"version\\".*?},\\"version\\":1}"/;
const HARDHAT_OUTPUT_FORMAT_REGEX = /"hh-sol-build-info-1"/;

export function createMetadataContractsFromPaths(
  paths: string[],
  ignoring?: string[],
  unused?: string[],
) {
  const files: PathBuffer[] = [];
  paths.forEach((path) => {
    if (fs.existsSync(path)) {
      traversePathRecursively(path, (filePath) => {
        const fullPath = Path.resolve(filePath);
        const file = { buffer: fs.readFileSync(filePath), path: fullPath };
        files.push(file);
      });
    } else if (ignoring) {
      ignoring.push(path);
    }
  });

  return createMetadataContractsFromFiles(files, unused);
}

export async function createMetadataContractsFromFiles(
  files: PathBuffer[],
  unused?: string[],
) {
  logInfo('Creating metadata contracts from files', {
    numberOfFiles: files.length,
  });
  await unzipFiles(files);
  const parsedFiles: PathContent[] = files.map((pathBuffer) => ({
    content: pathBuffer.buffer.toString(),
    path: pathBuffer.path,
  }));
  const { metadataFiles, sourceFiles } = splitFiles(parsedFiles);

  const metadataContracts: SolidityMetadataContract[] = [];
  const usedFiles: string[] = [];

  metadataFiles.forEach((metadata) => {
    if (metadata.language === 'Solidity') {
      const metadataContract = new SolidityMetadataContract(
        metadata,
        sourceFiles,
      );
      metadataContracts.push(metadataContract);

      // Track used files
      if (metadataContract.metadataPathToProvidedFilePath) {
        const currentUsedFiles = Object.values(
          metadataContract.metadataPathToProvidedFilePath,
        );
        usedFiles.push(...currentUsedFiles);
      }
    } else if (metadata.language === 'Vyper') {
      throw new Error('Can only handle Solidity metadata files');
    } else {
      throw new Error('Unsupported language');
    }
  });

  // Track unused files if the parameter is provided
  if (unused) {
    extractUnused(sourceFiles, usedFiles, unused);
  }

  logInfo('SolidityMetadataContracts', {
    contracts: metadataContracts.map((c) => c.name),
  });
  return metadataContracts;
}

/**
 * Splits the files into metadata and source files using heuristics.
 */
export function splitFiles(files: PathContent[]): {
  metadataFiles: Metadata[];
  sourceFiles: PathContent[];
} {
  const metadataFiles: Metadata[] = [];
  const sourceFiles: PathContent[] = [];

  for (const file of files) {
    // If hardhat output file, extract source and metadatas.
    if (file.content.match(HARDHAT_OUTPUT_FORMAT_REGEX)) {
      logDebug('Found a hardhat output file', { path: file.path });
      const { hardhatMetadataFiles, hardhatSourceFiles } =
        extractHardhatMetadataAndSources(file);
      sourceFiles.push(...hardhatSourceFiles);
      metadataFiles.push(...hardhatMetadataFiles);
      continue;
    }

    let metadata = extractMetadataFromString(file.content);

    if (metadata) {
      assertCompilationTarget(metadata);
      metadataFiles.push(metadata);
      continue;
    }

    // If metadata is nested within another string, extract it.
    const matchRes = file.content.match(NESTED_METADATA_REGEX);
    if (matchRes) {
      metadata = extractMetadataFromString(matchRes[0]);
      if (metadata) {
        assertCompilationTarget(metadata);
        metadataFiles.push(metadata);
        continue;
      }
    }

    // Otherwise, assume it's a source file.
    sourceFiles.push(file);
  }

  logDebug('Split files', {
    metadataFilesCount: metadataFiles.length,
    sourceFilesCount: sourceFiles.length,
  });

  return { metadataFiles, sourceFiles };
}

export function extractHardhatMetadataAndSources(hardhatFile: PathContent) {
  const hardhatMetadataFiles: any[] = [];
  const hardhatSourceFiles: PathContent[] = [];

  logDebug('Processing Hardhat file', {
    hardhatFileSize: new TextEncoder().encode(hardhatFile.content).length,
    path: hardhatFile.path,
  });
  const startTime = Date.now();
  // TODO: Test how long it takes to parse a large hardhat file. If it's too slow,
  // we should use a streaming parser.
  const hardhatJson = JSON.parse(hardhatFile.content);
  const endTime = Date.now();
  logDebug(`Parsing hardhat file took ${endTime - startTime} milliseconds.`);

  // Extract source files
  const hardhatSourceFilesObject = hardhatJson.input.sources;
  for (const path in hardhatSourceFilesObject) {
    if (hardhatSourceFilesObject[path].content) {
      hardhatSourceFiles.push({
        path: path,
        content: hardhatSourceFilesObject[path].content,
      });
    }
  }

  // Extract metadata files
  const contractsObject = hardhatJson.output.contracts;
  for (const path in contractsObject) {
    for (const contractName in contractsObject[path]) {
      if (contractsObject[path][contractName].metadata) {
        const metadataObj = extractMetadataFromString(
          contractsObject[path][contractName].metadata,
        );
        if (metadataObj) {
          hardhatMetadataFiles.push(metadataObj);
        }
      }
    }
  }

  logDebug('Extracted metadata and sources from hardhat file', {
    metadataFilesCount: hardhatMetadataFiles.length,
    sourceFilesCount: hardhatSourceFiles.length,
  });
  return { hardhatMetadataFiles, hardhatSourceFiles };
}

function extractMetadataFromString(file: string): Metadata | null {
  try {
    let obj = JSON.parse(file);
    if (isMetadata(obj)) {
      return obj as Metadata;
    }

    // if the input string originates from a file where it was double encoded (e.g. truffle)
    obj = JSON.parse(obj);
    if (isMetadata(obj)) {
      return obj as Metadata;
    }
  } catch (err) {
    // Fail silently.
  }

  return null;
}
/**
 * Applies the provided worker function to the provided path recursively.
 *
 * @param path the path to be traversed
 * @param worker the function to be applied on each file that is not a directory
 * @param afterDir the function to be applied on the directory after traversing its children
 */
function traversePathRecursively(
  path: string,
  worker: (filePath: string) => void,
  afterDirectory?: (filePath: string) => void,
) {
  if (!fs.existsSync(path)) {
    const msg = `Encountered a nonexistent path: ${path}`;
    const error = new Error(msg);
    throw error;
  }

  const fileStat = fs.lstatSync(path);
  if (fileStat.isFile()) {
    worker(path);
  } else if (fileStat.isDirectory()) {
    fs.readdirSync(path).forEach((nestedName) => {
      const nestedPath = Path.join(path, nestedName);
      traversePathRecursively(nestedPath, worker, afterDirectory);
    });

    if (afterDirectory) {
      afterDirectory(path);
    }
  }
}

function isMetadata(obj: any): boolean {
  return (
    (obj?.language === 'Vyper' || obj?.language === 'Solidity') &&
    !!obj?.settings?.compilationTarget &&
    !!obj?.version &&
    !!obj?.output?.abi &&
    !!obj?.output?.userdoc &&
    !!obj?.output?.devdoc &&
    !!obj?.sources
  );
}

function assertCompilationTarget(metadata: Metadata) {
  if (!metadata.settings.compilationTarget) {
    throw new Error(`Compilation target not found for the metadata file`);
  }
  if (Object.keys(metadata.settings.compilationTarget).length !== 1) {
    throw new Error(
      `Metadata must have exactly one compilation target. Found: ${Object.keys(metadata.settings.compilationTarget).join(', ')}`,
    );
  }
}

export async function useAllSourcesAndReturnCompilation(
  solidityCompilation: SolidityCompilation,
  files: PathBuffer[],
) {
  await unzipFiles(files);
  const parsedFiles = files.map((pathBuffer) => ({
    content: pathBuffer.buffer.toString(),
    path: pathBuffer.path,
  }));
  const { sourceFiles } = splitFiles(parsedFiles);
  const stringMapSourceFiles = pathContentArrayToStringMap(sourceFiles);

  // Create a proper Sources object from the StringMap
  const sourcesObject: Sources = {};

  // First add all sources from the string map
  for (const path in stringMapSourceFiles) {
    sourcesObject[path] = {
      content: stringMapSourceFiles[path],
    };
  }

  // Then add all sources from the solidityCompilation (which are already hash matched)
  // These will override any duplicates from the string map
  for (const path in solidityCompilation.jsonInput.sources) {
    sourcesObject[path] = solidityCompilation.jsonInput.sources[path];
  }

  // Create a new SolidityJsonInput with the combined sources
  const newJsonInput: SolidityJsonInput = {
    language: solidityCompilation.jsonInput.language,
    sources: sourcesObject,
    settings: solidityCompilation.jsonInput.settings,
  };

  const solidityCompilationWithAllSources = new SolidityCompilation(
    solidityCompilation.compiler,
    solidityCompilation.compilerVersion,
    newJsonInput,
    solidityCompilation.compilationTarget,
  );
  return solidityCompilationWithAllSources;
}

/**
 * Validates metadata content keccak hashes for all files and
 * returns mapping of file contents by file name
 * @param  {any}       metadata
 * @param  {Map<string, any>}  byHash    Map from keccak to source
 * @return foundSources, missingSources, invalidSources
 */
export function rearrangeSources(
  metadata: any,
  byHash: Map<string, PathContent>,
) {
  const foundSources: StringMap = {};
  const missingSources: MissingSources = {};
  const invalidSources: InvalidSources = {};
  const metadata2provided: StringMap = {}; // maps fileName as in metadata to the fileName of the provided file

  for (const sourcePath in metadata.sources) {
    const sourceInfoFromMetadata = metadata.sources[sourcePath];
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
        invalidSources[sourcePath] = {
          expectedHash: expectedHash,
          calculatedHash: contentHash,
          msg: `The keccak256 given in the metadata and the calculated keccak256 of the source content in metadata don't match`,
        };
        continue;
      }
    } else {
      // Get source from input files by hash
      const pathContent = byHash.get(expectedHash);
      if (pathContent) {
        file = pathContent;
        metadata2provided[sourcePath] = pathContent.path;
      } // else: no file has the hash that was searched for
    }

    if (file && file.content) {
      foundSources[sourcePath] = file.content;
    } else {
      missingSources[sourcePath] = {
        keccak256: expectedHash,
        urls: sourceInfoFromMetadata.urls,
      };
    }
  }

  return {
    foundSources,
    missingSources,
    invalidSources,
    metadata2provided,
    language: metadata.language,
  };
}
