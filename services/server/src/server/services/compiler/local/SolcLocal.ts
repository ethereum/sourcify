import {
  CompilerOutput,
  ISolidityCompiler,
  JsonInput,
} from "@ethereum-sourcify/lib-sourcify";
import { useCompiler } from "./solidityCompiler";

export class SolcLocal implements ISolidityCompiler {
  constructor(
    private solcRepoPath: string,
    private solJsonRepoPath: string,
  ) {}

  async compile(
    version: string,
    solcJsonInput: JsonInput,
    forceEmscripten: boolean = false,
  ): Promise<CompilerOutput> {
    return await useCompiler(
      this.solcRepoPath,
      this.solJsonRepoPath,
      version,
      solcJsonInput,
      forceEmscripten,
    );
  }
}
