import dotenv from "dotenv";
import { fetchVerifiedContracts, formatVerifiedContracts } from "./fetch-rows";
import DuneClient from "./DuneDataClient";
import DuneTableClient from "./DuneTableClient";

dotenv.config();

async function main() {
  // const tableClient = new DuneTableClient(process.env.DUNE_API_KEY!);
  // const tableResponse = await tableClient.deleteVerifiedContractsTable();
  // const tableResponse = await tableClient.createVerifiedContractsTable();
  // console.log(`tableResponse.status: ${tableResponse.status}`);
  // console.log(`tableResponse.statusText: ${tableResponse.statusText}`);
  // console.log(`tableResponse.ok: ${tableResponse.ok}`);
  // console.log(`tableResponse.body: ${await tableResponse.text()}`);
  const verifiedContracts = await fetchVerifiedContracts();
  if (!verifiedContracts) {
    console.error("No verified contracts found");
    return;
  }
  const formattedVerifiedContracts = formatVerifiedContracts(verifiedContracts);
  console.log(formattedVerifiedContracts);
  const dataClient = new DuneClient(process.env.DUNE_API_KEY!);
  const dataResponse = await dataClient.insertVerifiedContracts(
    formattedVerifiedContracts,
  );
  console.log(`dataResponse.status: ${dataResponse.status}`);
  console.log(`dataResponse.statusText: ${dataResponse.statusText}`);
  console.log(`dataResponse.ok: ${dataResponse.ok}`);
  console.log(
    `dataResponse.body: ${JSON.stringify(await dataResponse.json())}`,
  );
}

main();
