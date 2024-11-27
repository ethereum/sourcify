import {
  CompilerOutput,
  ISolidityCompiler,
  VyperJsonInput,
} from "@ethereum-sourcify/lib-sourcify";
import { useVyperCompiler } from "./vyperCompiler";

export class VyperLocal implements ISolidityCompiler {
  async compile(
    version: string,
    vyperJsonInput: VyperJsonInput,
    forceEmscripten: boolean = false,
  ): Promise<CompilerOutput> {
    return await useVyperCompiler(version, vyperJsonInput);
  }
}
