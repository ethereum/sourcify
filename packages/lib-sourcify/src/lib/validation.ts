import { CheckedContract } from './CheckedContract';
import { id as keccak256str } from 'ethers';
import {
  InvalidSources,
  MissingSources,
  PathBuffer,
  PathContent,
  StringMap,
} from './types';
import JSZip from 'jszip';
// @TODO: Handle compatibility for browser, below are nodejs imports
import fs from 'fs';
import Path from 'path';

/**
 * Regular expression matching metadata nested within another json.
 */
const NESTED_METADATA_REGEX =
  /"{\\"compiler\\":{\\"version\\".*?},\\"version\\":1}"/;
const HARDHAT_OUTPUT_FORMAT_REGEX = /"hh-sol-build-info-1"/;

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

  return checkFiles(files);
}

// Pass all input source files to the CheckedContract, not just those stated in metadata.
export async function useAllSources(
  contract: CheckedContract,
  files: PathBuffer[]
) {
  await unzipFiles(files);
  const parsedFiles = files.map((pathBuffer) => ({
    content: pathBuffer.buffer.toString(),
    path: pathBuffer.path,
  }));
  const { sourceFiles } = splitFiles(parsedFiles);
  const stringMapSourceFiles = pathContentArrayToStringMap(sourceFiles);
  // Files at contract.solidity are already hash matched with the sources in metadata. Use them instead of the user input .sol files.
  Object.assign(stringMapSourceFiles, contract.solidity);
  const contractWithAllSources = new CheckedContract(
    contract.metadata,
    stringMapSourceFiles,
    contract.missing,
    contract.invalid
  );
  return contractWithAllSources;
}

export async function checkFiles(files: PathBuffer[], unused?: string[]) {
  await unzipFiles(files);
  const parsedFiles = files.map((pathBuffer) => ({
    content: pathBuffer.buffer.toString(),
    path: pathBuffer.path,
  }));
  const { metadataFiles, sourceFiles } = splitFiles(parsedFiles);

  const checkedContracts: CheckedContract[] = [];

  const byHash = storeByHash(sourceFiles);
  const usedFiles: string[] = [];

  metadataFiles.forEach((metadata) => {
    const { foundSources, missingSources, invalidSources, metadata2provided } =
      rearrangeSources(metadata, byHash);
    const currentUsedFiles = Object.values(metadata2provided);
    usedFiles.push(...currentUsedFiles);
    const checkedContract = new CheckedContract(
      metadata,
      foundSources,
      missingSources,
      invalidSources
    );
    checkedContracts.push(checkedContract);
  });

  if (unused) {
    extractUnused(sourceFiles, usedFiles, unused);
  }

  return checkedContracts;
}

/**
 * Unzips any zip files found in the provided array of files. Modifies the provided array.
 *
 * @param files the array containing the files to be checked
 */
export async function unzipFiles(files: PathBuffer[]) {
  const allUnzipped: PathBuffer[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (isZip(file.buffer)) {
      const unzipped = await unzip(file);
      allUnzipped.push(...unzipped);
      // Remove the zip file from the array and decrement the index to check the next file.
      files.splice(i, 1);
      i--;
    }
  }
  // Add unzipped at the end to not check again if the extracted files are zips.
  files.push(...allUnzipped);
}

function isZip(file: Buffer): boolean {
  // How is-zip-file checks https://github.com/luthraG/is-zip-file/blob/master/index.js
  // Also according to this: https://stackoverflow.com/a/18194946/6528944
  const response =
    file[0] === 0x50 &&
    file[1] === 0x4b &&
    (file[2] === 0x03 || file[2] === 0x05 || file[2] === 0x07) &&
    (file[3] === 0x04 || file[3] === 0x06 || file[3] === 0x08);
  return response;
}

/**
 * Unzips the provided file buffer to the provided array.
 *
 * @param zippedFile the buffer containin the zipped file to be unpacked
 * @param files the array to be filled with the content of the zip
 * @returns the unzipped files as an array
 */
async function unzip(zippedFile: PathBuffer) {
  const zip = new JSZip();
  const unzipped: PathBuffer[] = [];
  try {
    await zip.loadAsync(zippedFile.buffer);
    for (const filePath in zip.files) {
      const buffer = await zip.files[filePath].async('nodebuffer');
      unzipped.push({
        path: filePath,
        buffer,
      });
    }
  } catch (e: any) {
    throw new Error(`Error while unzipping ${zippedFile.path}: ${e.message}`);
  }
  return unzipped;
}

/**
 * Selects metadata files from an array of files that may include sources, etc
 * @param  {string[]} files
 * @return {string[]}         metadata
 */
function splitFiles(files: PathContent[]): {
  metadataFiles: any[];
  sourceFiles: PathContent[];
} {
  const metadataFiles = [];
  const sourceFiles: PathContent[] = [];
  const malformedMetadataFiles = [];

  for (const file of files) {
    // If hardhat output file, extract source and metadatas.
    if (file.content.match(HARDHAT_OUTPUT_FORMAT_REGEX)) {
      const { hardhatMetadataFiles, hardhatSourceFiles } =
        extractHardhatMetadataAndSources(file);
      sourceFiles.push(...hardhatSourceFiles);
      metadataFiles.push(...hardhatMetadataFiles);
      continue;
    }

    let metadata = extractMetadataFromString(file.content);
    if (!metadata) {
      const matchRes = file.content.match(NESTED_METADATA_REGEX);
      if (matchRes) {
        metadata = extractMetadataFromString(matchRes[0]);
      }
    }

    if (metadata) {
      try {
        assertObjectSize(metadata.settings.compilationTarget, 1);
        metadataFiles.push(metadata);
      } catch (err) {
        malformedMetadataFiles.push(file.path);
      }
    } else {
      sourceFiles.push(file);
    }
  }

  let msg = '';
  if (malformedMetadataFiles.length) {
    const responsibleFiles = malformedMetadataFiles.every(Boolean)
      ? malformedMetadataFiles.join(', ')
      : `${malformedMetadataFiles.length} metadata files`;
    msg = `Couldn't parse metadata files or they are malformed. Can't find settings.compilationTarget or multiple compilationTargets in: ${responsibleFiles}`;
  } else if (!metadataFiles.length) {
    msg = 'Metadata file not found. Did you include "metadata.json"?';
  }

  if (msg) {
    const error = new Error(msg);
    throw error;
  }

  return { metadataFiles, sourceFiles };
}

/**
 * Validates metadata content keccak hashes for all files and
 * returns mapping of file contents by file name
 * @param  {any}       metadata
 * @param  {Map<string, any>}  byHash    Map from keccak to source
 * @return foundSources, missingSources, invalidSources
 */
function rearrangeSources(metadata: any, byHash: Map<string, PathContent>) {
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

  return { foundSources, missingSources, invalidSources, metadata2provided };
}

/**
 * Generates a map of files indexed by the keccak hash of their content.
 *
 * @param  {string[]}  files Array containing sources.
 * @returns Map object that maps hash to PathContent.
 */
export function storeByHash(files: PathContent[]): Map<string, PathContent> {
  const byHash: Map<string, PathContent> = new Map();

  for (const pathContent of files) {
    for (const variation of generateVariations(pathContent)) {
      const calculatedHash = keccak256str(variation.content);
      byHash.set(calculatedHash, variation);
    }
  }

  return byHash;
}

function generateVariations(pathContent: PathContent): PathContent[] {
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

function extractUnused(
  inputFiles: PathContent[],
  usedFiles: string[],
  unused: string[]
): void {
  const usedFilesSet = new Set(usedFiles);
  const tmpUnused = inputFiles
    .map((pc) => pc.path)
    .filter((file) => !usedFilesSet.has(file));
  unused.push(...tmpUnused);
}

function extractMetadataFromString(file: string): any {
  try {
    let obj = JSON.parse(file);
    if (isMetadata(obj)) {
      return obj;
    }

    // if the input string originates from a file where it was double encoded (e.g. truffle)
    obj = JSON.parse(obj);
    if (isMetadata(obj)) {
      return obj;
    }
  } catch (err) {
    undefined;
  } // Don't throw here as other files can be metadata files.

  return null;
}

/**
 * A method that checks if the provided object was generated as a metadata file of a Solidity contract.
 * Current implementation is rather simplistic and may require further engineering.
 *
 * @param metadata the JSON to be checked
 * @returns true if the provided object is a Solidity metadata file; false otherwise
 */
function isMetadata(obj: any): boolean {
  return (
    obj?.language === 'Solidity' &&
    !!obj?.settings?.compilationTarget &&
    !!obj?.version &&
    !!obj?.output?.abi &&
    !!obj?.output?.userdoc &&
    !!obj?.output?.devdoc &&
    !!obj?.sources
  );
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
  afterDirectory?: (filePath: string) => void
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

/**
 * Asserts that the number of keys of the provided object is expectedSize.
 * If not, logs an appropriate message (if log function provided) and throws an Error.
 * @param object the object to check
 * @param expectedSize the size that the object should have
 */
function assertObjectSize(object: any, expectedSize: number) {
  let err = '';

  if (!object) {
    err = `Cannot assert for ${object}.`;
  } else {
    const objectSize = Object.keys(object).length;
    if (objectSize !== expectedSize) {
      err = `Error in size assertion! Actual size: ${objectSize}. Expected size: ${expectedSize}.`;
    }
  }

  if (err) {
    const error = new Error(err);
    throw error;
  }
}

/**
 * Hardhat build output can contain metadata and source files of every contract used in compilation.
 * Extracts these files from a given hardhat file following the hardhat output format.
 *
 * @param hardhatFile
 * @returns - {hardhatMetadataFiles, hardhatSourceFiles}
 */
export function extractHardhatMetadataAndSources(hardhatFile: PathContent) {
  const hardhatMetadataFiles: any[] = [];
  const hardhatSourceFiles: PathContent[] = [];

  const hardhatJson = JSON.parse(hardhatFile.content);

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
          contractsObject[path][contractName].metadata
        );
        hardhatMetadataFiles.push(metadataObj);
      }
    }
  }
  return { hardhatMetadataFiles, hardhatSourceFiles };
}

export function pathContentArrayToStringMap(pathContentArr: PathContent[]) {
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
