import { S3Client } from "@aws-sdk/client-s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import assert from "assert";

const bareBonesS3 = new S3Client({
  region: "eu-west-2",
  credentials: {
    accessKeyId: process.env.AWS_S3_READ_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_READ_SECRET_ACCESS_KEY,
  },
});

// fetch latest workflow id
const branch = "master";
const circleCIWorkflowsUrl = `https://circleci.com/api/v2/insights/gh/ethereum/sourcify/workflows/e2e-tests?branch=${branch}`;
const circleCIWorkflowsResult = await fetch(circleCIWorkflowsUrl);
const circleCIWorkflowsJson = await circleCIWorkflowsResult.json();

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const circleCIWorkflowsYesterdayItem = circleCIWorkflowsJson.items.find(
  (item) => {
    const workflowDate = new Date(item.created_at);
    return yesterday.toDateString() === workflowDate.toDateString();
  }
);
assert(
  circleCIWorkflowsYesterdayItem !== undefined,
  `There is no backup workflow from yesterday`
);

const workflowId = circleCIWorkflowsYesterdayItem.id;

// find jobs id of verification-e2e-sepolia, verification-e2e-goerli
const jobsWithArtifacts = [
  "verification-e2e-sepolia",
  "verification-e2e-goerli",
];
const circleCIJobsUrl = `https://circleci.com/api/v2/workflow/${workflowId}/job`;
console.log("Fetching jobs from: ", circleCIJobsUrl);
const circleCIJobsUrlResult = await fetch(circleCIJobsUrl);
const circleCIJobsUrlJson = await circleCIJobsUrlResult.json();
const jobs = circleCIJobsUrlJson.items.filter((job) =>
  jobsWithArtifacts.includes(job.name)
);

// for each job id get the artifact and check the existance on s3
let existance = false;
for (const job of jobs) {
  console.log(`Checking job with name: ${job.name} and id: ${job.id}`);
  const circleCIArtifactVerifiedContractUrl = `https://dl.circleci.com/private/output/job/${job.id}/artifacts/0/verified-contracts/saved.json`;
  console.log("Fetching artifact from: ", circleCIArtifactVerifiedContractUrl);
  const circleCIArtifactVerifiedContractResult = await fetch(
    circleCIArtifactVerifiedContractUrl
  );
  const circleCIArtifactVerifiedContractJson =
    await circleCIArtifactVerifiedContractResult.json();
  const { deploymentAddress, deploymentChain } =
    circleCIArtifactVerifiedContractJson;

  if (!deploymentAddress || !deploymentChain) {
    throw new Error(
      `Deployment address or chain not found in job ${job.id} with name ${job.name}. Deployment address: ${deploymentAddress}, Deployment chain: ${deploymentChain}`
    );
  }

  try {
    const s3Object = await bareBonesS3.send(
      new GetObjectCommand({
        Key: `stable/repository/contracts/full_match/${deploymentChain}/${deploymentAddress}/metadata.json`,
        Bucket: "sourcify-backup-s3",
      })
    );

    if (s3Object.ETag?.length > 0) {
      existance = true;
      break;
    }
  } catch (e) {
    console.log(e);
    console.log(
      `not in backup: stable/repository/contracts/full_match/${deploymentChain}/${deploymentAddress}/metadata.json`
    );
  }
}

bareBonesS3.destroy();
assert(existance, "Last nightly backup didn't worked");
