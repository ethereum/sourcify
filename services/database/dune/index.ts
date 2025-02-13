import dotenv from "dotenv";
import { SourcifyDuneSyncClient } from "./SourcifyDuneSyncClient";

dotenv.config();

const main = async () => {
  const sourcifyDuneSyncClient = new SourcifyDuneSyncClient(
    process.env.DUNE_API_KEY!,
  );
  await sourcifyDuneSyncClient.syncAll();
};

main();
