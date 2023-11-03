import { promises } from "fs";

const chainsUrl = "https://chainid.network/chains.json";
const chainsPath = "services/server/src/chains.json";

const result = await fetch(chainsUrl);
const chainsList = await result.text();

await promises.writeFile(chainsPath, chainsList);
