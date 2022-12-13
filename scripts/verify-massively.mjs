/**
 * This program verifies all the contracts in repository/contracts/{MATCH_TYPE}/{CHAIN_ID} one after the other
 * 
 * You need to give as input:
 *  - the repository folder: path
 *  - the MATCH_TYPE: full_match | partial_match
 *  - the CHAIN_ID: number
 * 
 * You can set the environment variable "API_URL" to change the sourcify host, default: https://staging.sourcify.dev/server/verify
 * 
 * example:
 * node ./scripts/test-high-demand.mjs /home/user/sourcify/repository/contracts full_match 421613
 */

import fetch from 'node-fetch';
import fs from 'fs'
import path from 'path'

const API_URL = process.env.API_URL || 'https://staging.sourcify.dev/server/verify';

const verifyFiles = async (address, chain, files) => {
  const contentType = 'application/json';
  const headers = { 'Content-Type': contentType };
  const body = {
    files,
    address,
    chain,
  };
  return await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function exploreDirectory(dir, obj) {
  // Get a list of all files in the directory
  const files = fs.readdirSync(dir);

  // Loop through each file in the directory
  for (const file of files) {
    // Get the full path of the file
    const filepath = `${dir}/${file}`;

    // Check if the file is a directory or a regular file
    if (fs.statSync(filepath).isDirectory()) {
      // If it's a directory, recursively explore it
      exploreDirectory(filepath, obj);
    } else {
      // If it's a regular file, read its contents and add it to the object
      obj[filepath] = fs.readFileSync(filepath, 'utf8');
    }
  }
}

export async function listFolders(dir) {
  const files = await fs.promises.readdir(dir);

  const folders = files.filter(file => {
    const filePath = path.join(dir, file);
    return fs.promises.stat(filePath).then(stat => stat.isDirectory());
  });

  return folders;
}


export async function verifyContractInPath(address, chain, contractPath) {
  // create an empty object to hold the file contents
  const files = {};

  // start exploring the target directory
  const targetDir = contractPath;
  exploreDirectory(targetDir, files);


  const filteredFiles = {}
  for (const key of Object.keys(files)) {
    filteredFiles[key.replace(targetDir, '')] = files[key]
  }

  const res = await verifyFiles(address, chain, filteredFiles)
  if (res.status !== 200) {
    throw new Error(`
Request failed for ${address} with status ${res.status}, body:

${await res.text()}
    `)
  }
  const response = await res.json()

  console.log(res.status, response.result[0].status, response.result[0].address)
}

if (process.argv?.length < 5) {
  console.log("Provide all arguments")
  process.exit()
}

const args = process.argv.slice(2);

const contractPath = args[0]
const matchType = args[1]
const chainId = args[2]

if (!fs.existsSync(contractPath)) {
  console.log("Path doesn't exists")
  process.exit()
}

if (matchType !== "partial_match" && matchType !== "full_match") {
  console.log("matchType should be partial_match or full_match")
  process.exit()
}

const chainFolder = `${contractPath}/${matchType}/${chainId}/`
if (!fs.existsSync(chainFolder)) {
  console.log("chainId doesn't exists in repo")
  process.exit()
}

const contracts = await listFolders(chainFolder)

for (const contract of contracts) {
  await verifyContractInPath(contract, chainId, `${chainFolder}${contract}`)
}