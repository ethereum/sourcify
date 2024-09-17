import {
  CompilerOutput,
  ISolidityCompiler,
  JsonInput,
} from "@ethereum-sourcify/lib-sourcify";
import { useCompiler } from "./solidityCompiler";

export class SolcLocal implements ISolidityCompiler {

  constructor(private repoPath: string) {
  }

  async compile(
    version: string,
    solcJsonInput: JsonInput,
    forceEmscripten: boolean = false,
  ): Promise<CompilerOutput> {
    return await useCompiler(this.repoPath, version, solcJsonInput, forceEmscripten);
  }
}
