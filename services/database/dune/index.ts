import dotenv from "dotenv";
import { fetchVerifiedContract } from "./migrate-verified-contracts.ts";
// import { insertVerifiedContract } from "./insert-data";

dotenv.config();

async function main() {
  const verifiedContract = await fetchVerifiedContract();
  console.log(verifiedContract);
  // await insertVerifiedContract(verifiedContract);
}

main();
