# compilers

Wrapper around multiple compilers to download the right version and invoke the compilation with a common interface.

## Install

```
npm i @ethereum-sourcify/compilers
```

## Usage

```ts
import {
  SolidityOutput,
  ISolidityCompiler,
  JsonInput,
} from '@ethereum-sourcify/lib-sourcify';
import { useSolidityCompiler } from '@ethereum-sourcify/compilers';

class SolcLocal implements ISolidityCompiler {
  constructor(
    private solcRepoPath: string,
    private solJsonRepoPath: string,
  ) {}

  async compile(
    version: string,
    solcJsonInput: JsonInput,
    forceEmscripten: boolean = false,
  ): Promise<SolidityOutput> {
    return await useSolidityCompiler(
      this.solcRepoPath,
      this.solJsonRepoPath,
      version,
      solcJsonInput,
      forceEmscripten,
    );
  }
}
```

The `SolcLocal` class can then be used as the `solidityCompiler` argument of the constructor of `SolidityCheckedContract`.
Vyper follows the same pattern.
