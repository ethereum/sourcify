import {
  CompilerOutput,
  ISolidityCompiler,
  JsonInput,
} from "@ethereum-sourcify/lib-sourcify";
import logger from "../../../../common/logger";
import { SolcLambda, LambdaResponseLimitExceeded } from "../lambda/SolcLambda";
import { SolcLocal } from "../local/SolcLocal";

export class SolcLambdaWithLocalFallback implements ISolidityCompiler {
  private solcLambda;
  private solcLocal;

  constructor(
    awsRegion: string,
    awsAccessKeyId: string,
    awsSecretAccessKey: string,
    lambdaCompilerFunctionName: string = "compile",
    repoPath: string,
  ) {
    this.solcLambda = new SolcLambda(
      awsRegion,
      awsAccessKeyId,
      awsSecretAccessKey,
      lambdaCompilerFunctionName,
    );
    this.solcLocal = new SolcLocal(repoPath);
  }

  public async compile(
    version: string,
    solcJsonInput: JsonInput,
    forceEmscripten: boolean = false,
  ): Promise<CompilerOutput> {
    let compilerOutput: CompilerOutput;
    try {
      compilerOutput = await this.solcLambda.compile(
        version,
        solcJsonInput,
        forceEmscripten,
      );
    } catch (e) {
      if (e instanceof LambdaResponseLimitExceeded) {
        logger.warn(
          "Lambda compilation exceeded stream response limit - Falling back to local compilation",
        );
        compilerOutput = await this.solcLocal.compile(
          version,
          solcJsonInput,
          forceEmscripten,
        );
      } else {
        throw e;
      }
    }
    return compilerOutput;
  }
}
