import { workerData, parentPort } from "worker_threads";
import { getSolcJs } from "./solidityCompiler";

async function runUseCompiler(version: string, inputStringified: string) {
  const solJson = await getSolcJs(version);
  const result = solJson.compile(inputStringified);
  if (parentPort === null) {
    throw new Error("Parent port is null; cannot send compilation result");
  }
  parentPort.postMessage(result);
}

runUseCompiler(workerData.version, workerData.inputStringified);
