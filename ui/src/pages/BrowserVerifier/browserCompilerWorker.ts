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

interface CompileCompilerMessage extends CompilerMessage {
  text: string;
}

let compiler: any;

self.onmessage = (e: WorkerMessageEvent) => {
  log(`Received message from main thread: ${e.data.type}`);
  switch (e.data.type) {
    case "loadCompiler": {
      const data = e.data as LoadCompilerMessage;
      log("Loading compiler from ", data.url);
      self.importScripts(data.url);
      log("importScripts done");
      compiler = wrapper((self as any).Module);
      log("Compiler loaded");

      self.postMessage({ type: "compilerLoaded" });
      break;
    }
    case "compile": {
      if (!compiler) {
        console.error("Compiler not loaded");
        return;
      }
      const data = e.data as CompileCompilerMessage;
      log("Compiling: ", data.text);
      const result = compiler.compile(data.text);
      log("Compilation result: ", result);
      self.postMessage({ type: "compilationResult", result });
      break;
    }
    default: {
      console.error("Unknown message type: ", e.data.type);
    }
  }
};
