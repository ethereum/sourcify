import {
  CompilerOutput,
  ISolidityCompiler,
  JsonInput,
} from "@ethereum-sourcify/lib-sourcify";
import { useCompiler } from "./solidityCompiler";

export class SolcLocal implements ISolidityCompiler {
  async compile(
    version: string,
    solcJsonInput: JsonInput,
    forceEmscripten: boolean = false,
  ): Promise<CompilerOutput> {
    return await useCompiler(version, solcJsonInput, forceEmscripten);
  }
}
