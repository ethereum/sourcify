// Tools to assemble SolidityMetadataContract(s) from files.

import { logDebug, logError, logInfo } from '../lib/logger';
import { Metadata, PathBuffer, PathContent } from '../lib/types';
import { SolidityMetadataContract } from './SolidityMetadataContract';
import { unzipFiles } from './zipUtils';
import fs from 'fs';
import Path from 'path';
/**
 * Regular expression matching metadata nested within another string.
 * Assumes metadata's first key is "compiler" and the last key is "version".
 * This is true for the metadata files generated by the compiler as it's canonicalized by sorting the keys.
 */
const NESTED_METADATA_REGEX =
  /"{\\"compiler\\":{\\"version\\".*?},\\"version\\":1}"/;
const HARDHAT_OUTPUT_FORMAT_REGEX = /"hh-sol-build-info-1"/;

export function checkPaths(paths: string[], ignoring?: string[]) {
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

  return checkFilesWithMetadata(files);
}

export async function checkFilesWithMetadata(files: PathBuffer[]) {
  logInfo('Checking files', { numberOfFiles: files.length });
  await unzipFiles(files);
  const parsedFiles: PathContent[] = files.map((pathBuffer) => ({
    content: pathBuffer.buffer.toString(),
    path: pathBuffer.path,
  }));
  const { metadataFiles, sourceFiles } = splitFiles(parsedFiles);

  const metadataContracts: SolidityMetadataContract[] = [];

  metadataFiles.forEach((metadata) => {
    if (metadata.language === 'Solidity') {
      const metadataContract = new SolidityMetadataContract(
        metadata,
        sourceFiles,
      );
      metadataContracts.push(metadataContract);
    } else if (metadata.language === 'Vyper') {
      throw new Error('Can only handle Solidity metadata files');
    } else {
      throw new Error('Unsupported language');
    }
  });

  logInfo('SolidityMetadataContracts', {
    contracts: metadataContracts.map((c) => c.name),
  });
  return metadataContracts;
}

/**
 * Splits the files into metadata and source files using heuristics.
 */
function splitFiles(files: PathContent[]): {
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
