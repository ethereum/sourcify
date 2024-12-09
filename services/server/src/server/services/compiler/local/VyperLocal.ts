import {
  IVyperCompiler,
  VyperJsonInput,
  VyperOutput,
} from "@ethereum-sourcify/lib-sourcify";
import { useVyperCompiler } from "./vyperCompiler";

export class VyperLocal implements IVyperCompiler {
  constructor(private vyperRepoPath: string) {}

  async compile(
    version: string,
    vyperJsonInput: VyperJsonInput,
  ): Promise<VyperOutput> {
    return await useVyperCompiler(this.vyperRepoPath, version, vyperJsonInput);
  }
}
