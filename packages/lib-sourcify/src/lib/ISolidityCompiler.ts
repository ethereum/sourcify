import { CompilerOutput, JsonInput } from './types';

export interface ISolidityCompiler {
  compile(
    version: string,
    solcJsonInput: JsonInput,
    forceEmscripten?: boolean,
  ): Promise<CompilerOutput>;
}
