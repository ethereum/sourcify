const assert = require("assert");
require("dotenv").config({ path: "environments/.env" });
const { spawnSync } = require("child_process");

const deploymentChain = process.argv[2];
assert(deploymentChain, "No chain provided");
const artifact = require("../metacoin-source-verify/MetaCoinSalted.json");
const deploymentAddress = artifact.networks[deploymentChain].address;
const buildInfoFilename = artifact.networks[deploymentChain].buildInfoFilename;

assert(
  deploymentAddress,
  `No address found - has the contract been deployed to chain ${deploymentChain}?`
);

const serverUrl = process.env.SERVER_URL;
console.log("server:", serverUrl);

const args = [
  "-X",
  "POST",
  serverUrl,
  "-F",
  `files=@metacoin-source-verify/artifacts/build-info/${buildInfoFilename}`,
  "-F",
  "chosenContract=1",
];

if (deploymentChain) {
  args.push("-F", `address=${deploymentAddress}`);
  args.push("-F", `chain=${deploymentChain}`);
}

const response = spawnSync("curl", args);

const curlOutputRaw = response.stdout.toString();
console.log("Raw output:");
console.log(curlOutputRaw);
assert(curlOutputRaw, `Fetch failed: ${response.stderr.toString()}`);
let curlJson;

try {
  curlJson = JSON.parse(curlOutputRaw);
  console.log(JSON.stringify(curlJson, null, 2));
} catch (err) {
  // Workaround when server returns 504 Gateway Timeout nginx. Try again
  console.error(err);
  console.log("Failed to parse the server response. Trying again...");
  const newResponse = spawnSync("curl", args);
  const newCurlOutputRaw = newResponse.stdout.toString();
  console.log("Raw output:");
  console.log(newCurlOutputRaw);
  assert(newCurlOutputRaw, `Fetch failed: ${newResponse.stderr.toString()}`);
  curlJson = JSON.parse(newCurlOutputRaw);
  console.log(JSON.stringify(curlJson, null, 2));
}

assert(curlJson.result, "No `result` in response");
const resultArr = curlJson.result;

assert(
  resultArr.length === 1,
  `Should have 1 element in the result array. Actual: ${resultArr.length}`
);
const result = resultArr[0];

assert(
  result.address === deploymentAddress,
  `Address should be ${deploymentAddress}. Actual: ${result.address}`
);

const EXPECTED_STATUS = "perfect";
assert(
  result.status === EXPECTED_STATUS,
  `Status should be ${EXPECTED_STATUS}. Actual: ${result.status}`
);

// Store verified contract in the CircleCI artifacts
const fs = require("fs");
const verifiedContractPath = "./verified-contracts";
const verifiedContractFile = `${verifiedContractPath}/saved.json`;

try {
  fs.mkdirSync(`${verifiedContractPath}`, { recursive: true });
  fs.writeFileSync(
    verifiedContractFile,
    JSON.stringify({
      deploymentAddress,
      deploymentChain,
    })
  );
} catch (err) {
  console.error("Cannot write artifacts", err);
}

assert(
  fs.existsSync(verifiedContractFile),
  "Verified contract file was not saved"
);

console.log(`Verified contract saved in ${verifiedContractFile}.json`);
