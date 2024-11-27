import {
  CompilerOutput,
  ISolidityCompiler,
  VyperJsonInput,
} from "@ethereum-sourcify/lib-sourcify";
import { useVyperCompiler } from "./vyperCompiler";

export class VyperLocal implements ISolidityCompiler {
  constructor(private vyperRepoPath: string) {}

  async compile(
    version: string,
    vyperJsonInput: VyperJsonInput,
  ): Promise<CompilerOutput> {
    return await useVyperCompiler(this.vyperRepoPath, version, vyperJsonInput);
  }
}
