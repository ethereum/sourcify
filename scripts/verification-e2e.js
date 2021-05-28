const assert = require("assert");
require("dotenv").config({ path: "environments/.env" });
const { spawnSync } = require("child_process");

const deploymentAddress = process.argv[2];
assert(deploymentAddress, "No address provided");
const deploymentChain = process.argv[3];

const serverUrl = process.env.SERVER_URL;
console.log("server:", serverUrl);

const args = [
    "-X", "POST", serverUrl,
    "-F", "files=@metacoin-source-verify/build/contracts/MetaCoinSalted.json",
    "-F", "files=@metacoin-source-verify/contracts/MetaCoinSalted.sol",
    "-F", "files=@metacoin-source-verify/contracts/ConvertLib.sol"
];

if (deploymentChain) {
    args.push("-F", `address=${deploymentAddress}`);
    args.push("-F", `chain=${deploymentChain}`);
}

const response = spawnSync("curl", args);

const curlOutputRaw = response.stdout.toString();
assert(curlOutputRaw, `Fetch failed: ${response.stderr.toString()}`);
const curlJson = JSON.parse(curlOutputRaw);

console.log(JSON.stringify(curlJson, null, 2));

assert(curlJson.result, "No `result` in response");
const resultArr = curlJson.result;

assert(resultArr.length === 1, `Should have 1 element in the result array. Actual: ${resultArr.length}`);
const result = resultArr[0];

assert(result.address === deploymentAddress, `Address should be ${deploymentAddress}. Actual: ${result.address}`);

const EXPECTED_STATUS = "perfect";
assert(result.status === EXPECTED_STATUS, `Status should be ${EXPECTED_STATUS}. Actual: ${result.status}`);

const EXPECTED_CHAIN = deploymentChain || "5";
assert(result.chain === EXPECTED_CHAIN, `Chain should be ${EXPECTED_CHAIN}. Actual: ${result.chain}`);
