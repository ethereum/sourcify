import {
  CompilerOutput,
  ISolidityCompiler,
  JsonInput,
} from "@ethereum-sourcify/lib-sourcify";
import logger from "../../../../common/logger";
import { SolcLambda } from "../lambda/SolcLambda";
import { SolcLocal } from "../local/SolcLocal";

export class SolcLambdaWithLocalFallback implements ISolidityCompiler {
  private solcLambda = new SolcLambda();
  private solcLocal = new SolcLocal();

  public async compile(
    version: string,
    solcJsonInput: JsonInput,
    forceEmscripten: boolean = false
  ): Promise<CompilerOutput> {
    let compilerOutput: CompilerOutput;
    try {
      compilerOutput = await this.solcLambda.compile(
        version,
        solcJsonInput,
        forceEmscripten
      );
    } catch (e) {
      logger.error(
        "Lambda compilation error - Falling back to local compilation"
      );
      compilerOutput = await this.solcLocal.compile(
        version,
        solcJsonInput,
        forceEmscripten
      );
    }
    return compilerOutput;
  }
}
