import dotenv from "dotenv";
import { fetchSourcifyMatches } from "./fetchRows";
import DuneClient from "./DuneDataClient";
import DuneTableClient from "./DuneTableClient";
import { formatSourcifyMatches } from "./formatRows";

dotenv.config();

async function main() {
  // const tableClient = new DuneTableClient(process.env.DUNE_API_KEY!);
  // const tableResponse = await tableClient.createSourcifyMatchesTable();
  // console.log(`tableResponse.status: ${tableResponse.status}`);
  // console.log(`tableResponse.statusText: ${tableResponse.statusText}`);
  // console.log(`tableResponse.ok: ${tableResponse.ok}`);
  // console.log(`tableResponse.body: ${await tableResponse.text()}`);

  const sourcifyMatches = await fetchSourcifyMatches();
  if (!sourcifyMatches) {
    console.error("No sourcify matches found");
    return;
  }
  console.log(sourcifyMatches);
  const formattedSourcifyMatches = formatSourcifyMatches(sourcifyMatches);
  console.log(formattedSourcifyMatches);
  const dataClient = new DuneClient(process.env.DUNE_API_KEY!);
  const dataResponse = await dataClient.insertSourcifyMatches(
    formattedSourcifyMatches,
  );
  console.log(`dataResponse.status: ${dataResponse.status}`);
  console.log(`dataResponse.statusText: ${dataResponse.statusText}`);
  console.log(`dataResponse.ok: ${dataResponse.ok}`);
  console.log(
    `dataResponse.body: ${JSON.stringify(await dataResponse.json())}`,
  );
}

main();
