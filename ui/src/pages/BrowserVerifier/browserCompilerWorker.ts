/* eslint-disable no-restricted-globals */ // "self" is a global variable for workers
import wrapper from "solc/wrapper";
import debug from "debug";
const log = debug("browserCompilerWorker");
log.enabled = !process.env.NODE_ENV || process.env.NODE_ENV !== "production";

interface CompilerMessage {
  type: string;
}

interface WorkerMessageEvent extends MessageEvent {
  data: CompilerMessage;
}

interface LoadCompilerMessage extends CompilerMessage {
  url: string;
}

self.onmessage = (e: WorkerMessageEvent) => {
  log(`Received message from main thread: ${e.data.type}`);
  switch (e.data.type) {
    case "loadCompiler": {
      const data = e.data as LoadCompilerMessage;
      log("Loading compiler from ", data.url);
      self.importScripts(data.url);
      const compiler = wrapper(self);
      log(`Solc version: ${compiler.version()}`);

      self.postMessage({ type: "compilerLoaded" });
      break;
    }
    default: {
      console.error("Unknown message type: ", e.data.type);
    }
  }
};
