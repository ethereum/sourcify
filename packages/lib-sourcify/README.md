# lib-sourcify v2

[![codecov](https://codecov.io/gh/ethereum/sourcify/branch/staging/graph/badge.svg?token=eN6XDAwWfV&flag=lib-sourcify)](https://codecov.io/gh/ethereum/sourcify)

lib-sourcify is [Sourcify](https://sourcify.dev)'s reusable backbone library for verifying contracts. Version 2 introduces a completely redesigned architecture with improved abstractions, better support for both Solidity and Vyper contracts, and a more flexible verification process.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Key Concepts](#key-concepts)
- [Architecture](#architecture)
- [Compiler Setup](#compiler-setup)
- [Validation](#validation)
- [Verification](#verification)
- [Error Handling](#error-handling)
- [Usage Examples](#usage-examples)
- [Logging](#logging)
- [Migration Guide from v1 to v2](#migration-guide-from-v1-to-v2)

## Overview

lib-sourcify provides tools to validate, compile, and verify smart contracts. The library supports:

- **Solidity and Vyper contracts**: First-class support for both languages
- **Flexible verification workflow**: Validate contracts with metadata or directly with source files
- **Compiler independence**: Bring your own compiler implementation
- **Source fetching**: Automatically fetch missing source files from IPFS, Swarm, etc.
- **Bytecode matching**: Advanced bytecode analysis to handle various edge cases

## Installation

```bash
npm install @ethereum-sourcify/lib-sourcify
```

## Quick Start

Here's how to quickly get started with verifying a Solidity contract using lib-sourcify:

```typescript
import { createMetadataContractsFromFiles, Verification } from "@ethereum-sourcify/lib-sourcify";
import { useSolidityCompiler } from "@ethereum-sourcify/compilers";
import * as fs from "fs";

// Step 1: Setup your compiler
class Solc implements ISolidityCompiler {
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
      this.solcRepoPath, // useSolidityCompiler will automatically download and store solc here
      this.solJsonRepoPath, // useSolidityCompiler will automatically download and store solcjs here
      version,
      solcJsonInput,
      forceEmscripten,
    );
  }
}
const solc = new Solc(
  "/path/to/solc", 
  "/path/to/solcjs",
);

// Step 2: Prepare contract files
const pathBuffers = [
  {
    path: "metadata.json", 
    buffer: fs.readFileSync("metadata.json")
  },
  {
    path: "Contract.sol",
    buffer: fs.readFileSync("Contract.sol")
  }
];

// Step 3: Create a metadata contract
const metadataContracts = await createMetadataContractsFromFiles(pathBuffers);
const metadataContract = metadataContracts[0];

// Step 4: Fetch any missing sources
await metadataContract.fetchMissing();

// Step 5: Create a compilation
const compilation = await metadataContract.createCompilation(solc);

// Step 6: Verify the contract
const verification = new Verification(
  compilation,
  { id: 1, name: "Ethereum Mainnet", rpc: "https://eth.llamarpc.com" },
  "0xc0ffee254729296a45a3885639AC7E10F9d54979"
);
await verification.verify();

// Step 7: Check verification status
console.log(verification.status); // { runtimeMatch: 'perfect', creationMatch: null }
```

This example shows the complete verification flow for a Solidity contract. For Vyper contracts or more advanced use cases, see the detailed sections below.

## Architecture

lib-sourcify v2 consists of several key components:

- **Validation**: Validates contract source files and metadata
  - `SolidityMetadataContract`: Represents a Solidity contract with its metadata and source files
  - `processFiles`: Utility functions for processing files and extracting metadata

- **Compilation**: Handles contract compilation
  - `AbstractCompilation`: Base class for compilation
  - `SolidityCompilation`: Handles Solidity compilation
  - `VyperCompilation`: Handles Vyper compilation

- **Verification**: Compares compiled bytecode with on-chain bytecode
  - `Verification`: Main class orchestrating the verification process

## Compiler Setup

The `lib-sourcify` library does not come with compilers as dependencies. Instead, you need to provide a class that implements either the `ISolidityCompiler` or `IVyperCompiler` interface and pass it to any function that requires a compiler. We suggest you to use the official `@ethereum-sourcify/compilers` package.

### Solidity Compiler Example

```typescript
import {
  SolidityOutput,
  ISolidityCompiler,
  JsonInput,
} from '@ethereum-sourcify/lib-sourcify';
import { useSolidityCompiler } from '@ethereum-sourcify/compilers';

class Solc implements ISolidityCompiler {
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

const solc = new Solc();
```

### Vyper Compiler Example

```typescript
import { useVyperCompiler } from '@ethereum-sourcify/compilers';

import {
  IVyperCompiler,
  VyperOutput,
  VyperJsonInput,
} from "@ethereum-sourcify/lib-sourcify";

class Vyper implements IVyperCompiler {
  constructor(
    private vyperRepoPath: string,
  ) {}

  async compile(
    version: string,
    vyperJsonInput: VyperJsonInput
  ): Promise<VyperOutput> {
    return await useVyperCompiler(
      this.vyperRepoPath,
      version,
      vyperJsonInput,
    );
  }
}
const vyper = new Vyper();
```

## Validation

Note: Vyper contracts do not support validation through metadata files since they do not include a metadata JSON field in their bytecode. Instead, Vyper contracts must be verified directly using their source files and compiler settings.

### Validating Solidity Contracts with Metadata

v2 introduces the `SolidityMetadataContract` class which manages the validation workflow:

```typescript
import { SolidityMetadataContract } from "@ethereum-sourcify/lib-sourcify";

// Create a SolidityMetadataContract with metadata and sources
const metadataContract = new SolidityMetadataContract(metadata, sources);

// Create a compilation object that can be used for verification
const compilation = await metadataContract.createCompilation(solidityCompiler);
```

For file-based validation:

```typescript
import { createMetadataContractsFromFiles } from "@ethereum-sourcify/lib-sourcify";

const pathBuffers: PathBuffer[] = [];
pathBuffers.push({
  path: filePath,
  buffer: fs.readFileSync(filePath),
});

// Create SolidityMetadataContract objects from files
const metadataContracts = await createMetadataContractsFromFiles(pathBuffers);

// Create compilation objects
for (const contract of metadataContracts) {
  const compilation = await contract.createCompilation(solidityCompiler);
  // Use compilation for verification
}
```

### Fetching Missing Sources

Each contract source either has a `content` field containing the Solidity code as a string, or URLs to fetch the sources from (Github, IPFS, Swarm etc.). If sources are missing, you can fetch them:

```typescript
// Fetch missing sources
await metadataContract.fetchMissing();
```

By default, IPFS resources will be fetched via https://ipfs.io/ipfs. You can specify a custom IPFS gateway using `process.env.IPFS_GATEWAY=https://custom-gateway`, if you need to pass additional headers to the request (e.g. for authentication) you can use `process.env.IPFS_GATEWAY_HEADERS={ 'custom-header': 'value' }`.

You can check if a contract is ready to be compiled with:

```typescript
const isCompilable = metadataContract.isCompilable(); // true or false
```

## Verification

In v2, the verification process is handled by the `Verification` class:

```typescript
import { Verification } from "@ethereum-sourcify/lib-sourcify";

// Create a verification instance
const verification = new Verification(
  compilation,
  sourcifyChain,
  contractAddress,
  creatorTxHash // optional, for creation bytecode verification
);

// Perform verification
await verification.verify();

// Check verification status
console.log(verification.status.runtimeMatch); // 'perfect', 'partial', or null
```

### Verification Class Properties

The `Verification` class provides access to the following properties:

- `compilation`: The AbstractCompilation instance used for verification
  - `compilerVersion`: The version of the compiler used
  - `compilationTarget`: The target contract's path and name
  - `jsonInput`: The JSON input used for compilation
  - `compilerOutput`: The output from the compiler
  - `language`: The compilation language (Solidity or Vyper)
  - `creationBytecode`: The compiled creation bytecode
  - `runtimeBytecode`: The compiled runtime bytecode
  - `metadata`: The contract's metadata
  - `sources`: The contract's source files
  - `immutableReferences`: References to immutable variables
  - `runtimeLinkReferences`: Link references in runtime bytecode
  - `creationLinkReferences`: Link references in creation bytecode
  - `creationBytecodeCborAuxdata`: CBOR auxdata for creation bytecode
  - `runtimeBytecodeCborAuxdata`: CBOR auxdata for runtime bytecode

- `address`: The address of the contract being verified
- `status`: The verification status ('perfect', 'partial', or null)
- `onchainRuntimeBytecode`: The runtime bytecode retrieved from the blockchain
- `onchainCreationBytecode`: The creation bytecode retrieved from the blockchain
- `transformations`: Bytecode transformations applied during verification
- `deploymentInfo`: Information about the contract deployment (blockNumber, txIndex, deployer)
- `libraryMap`: The resolved library addresses used during verification
- `chainId`: The ID of the chain the contract is deployed on

### Detailed Property Structures

#### Verification Status

The `status` property of the `Verification` class returns an object with the following structure:

```typescript
{
  runtimeMatch: 'perfect' | 'partial' | null,  // Status of runtime bytecode verification
  creationMatch: 'perfect' | 'partial' | null  // Status of creation bytecode verification
}
```

Each match status can be one of:
- `'perfect'`: Complete bytecode match
- `'partial'`: Partial bytecode match
- `null`: No match

#### Transformations

The `transformations` property returns an object with transformation details for both runtime and creation bytecode:

```typescript
{
  runtime: {
    list: Transformation[],
    values: TransformationValues
  },
  creation: {
    list: Transformation[],
    values: TransformationValues
  }
}
```

Each `Transformation` object in the `list` arrays has the following structure:

```typescript
{
  type: 'insert' | 'replace',  // Whether bytes are inserted or replaced
  reason: 'constructorArguments' | 'library' | 'immutable' | 'cborAuxdata' | 'callProtection',  // Why the transformation is needed
  offset: number,  // Position in the bytecode where the transformation occurs, in bytes
  id?: string      // Optional identifier used for libraries, immutables, and CBOR auxdata
}
```

Different types of transformations include:

1. **Constructor Arguments Transformation**: Applied to handle constructor arguments in creation bytecode
   ```typescript
   {
     type: 'insert',
     reason: 'constructorArguments',
     offset: 12345  // Position where constructor arguments are appended
   }
   ```

2. **Library Transformation**: Applied to replace library placeholders with actual addresses
   ```typescript
   {
     type: 'replace',
     reason: 'library',
     offset: 12345,
     id: 'Library.sol:Math'  // Library identifier ("Fully Qualified Name" OR "Placeholder")
   }
   ```

3. **Immutables Transformation**: Applied to handle immutable variables
   ```typescript
   {
     type: 'replace', // "replace" for Solidity, "insert" for Vyper
     reason: 'immutable',
     offset: 12345,
     id: '3'  // Immutable variable index
   }
   ```

4. **CBOR Auxdata Transformation**: Applied to handle metadata hashes
   ```typescript
   {
     type: 'replace',
     reason: 'cborAuxdata',
     offset: 12345,
     id: '1'  // Index for the auxdata source
   }
   ```

5. **Call Protection Transformation**: Applied to handle differences in call protection mechanisms
   ```typescript
   {
     type: 'insert',
     reason: 'callProtection',
     offset: 1
   }
   ```

The actual values used in transformations are stored in corresponding value objects that follow this pattern:

```typescript
{
  constructorArguments?: string,
  callProtection?: string,
  libraries?: {
    [id: string]: string  // Maps library identifiers to addresses
  },
  immutables?: {
    [id: string]: string  // Maps immutable identifiers to values
  },
  cborAuxdata?: {
    [id: string]: string  // Maps auxdata identifiers to values
  }
}
```

#### DeploymentInfo

The `deploymentInfo` property returns information about the contract's deployment:

```typescript
{
  blockNumber?: number,  // Block number where the contract was deployed
  txIndex?: number,      // Transaction index within the block
  deployer?: string,     // Address that deployed the contract
  txHash?: string,       // Transaction hash
}
```

#### LibraryMap

The `libraryMap` property returns an object mapping library identifiers to their addresses:

```typescript
{
  [libraryName: string]: string  // E.g., '__$da57....$__': '0x1234...'
}
```

#### ImmutableReferences

The `immutableReferences` property (accessible via `compilation.immutableReferences`) is structured as:

```typescript
{
  [position: string]: {
    length: number,
    start: number
  }[]
}
```

Where:
- `position`: A string identifier for the immutable variable
- `length`: The length of the variable in bytes
- `start`: The starting position of the variable in the bytecode

#### LinkReferences

The `runtimeLinkReferences` and `creationLinkReferences` properties (accessible via `compilation`) are structured as:

```typescript
{
  [sourceFile: string]: {
    [libraryName: string]: {
      length: number,
      start: number
    }[]
  }
}
```

Where:
- `sourceFile`: The path to the source file containing the library
- `libraryName`: The name of the referenced library
- `length`: The length of the reference in bytes
- `start`: The starting position of the reference in the bytecode

#### BytecodeCborAuxdata

The `creationBytecodeCborAuxdata` and `runtimeBytecodeCborAuxdata` properties (accessible via `compilation`) provide information about CBOR metadata positions:

```typescript
{
  [id: string]: {
    offset: number,   // Position in the bytecode where the CBOR auxdata starts
    value: string     // The hexadecimal string of the CBOR auxdata
  }
}
```

This information is used to handle metadata hashes during verification.

## Error Handling

During verification, various errors can occur. In lib-sourcify v2, errors related to verification are thrown as `VerificationError` instances, which extend the `SourcifyLibError` class. These errors include a message and an error code that can be used to handle different error cases.

### Error Codes

The `VerificationErrorCode` type defines the following error codes:

https://github.com/ethereum/sourcify/blob/06363e3c27c3c2a6bff01670dd3cf7ce635ba60c/packages/lib-sourcify/src/Verification/VerificationTypes.ts#L14-L23

## Usage Examples

### Using SolidityMetadataContract

```typescript
import { SolidityMetadataContract, Verification } from "@ethereum-sourcify/lib-sourcify";

// Create a SolidityMetadataContract with metadata and sources
const metadataContract = new SolidityMetadataContract(metadata, sources);

// Create a compilation for verification
const compilation = await metadataContract.createCompilation(new TestSolidityCompiler());

// Verify against an on-chain contract
const verification = new Verification(
  compilation,
  sourcifyChainHardhat,
  contractAddress
);
await verification.verify();

// Check verification status
console.log(verification.status);
```

### Using SolidityCompilation Directly

```typescript
import { SolidityCompilation, Verification } from "@ethereum-sourcify/lib-sourcify";

// Create a compilation directly
const compilation = new SolidityCompilation(
  solc,
  metadata.compiler.version,
  jsonInput,
  { path, name } // compilationTarget
);

// Verify against an on-chain contract
const verification = new Verification(
  compilation,
  sourcifyChainHardhat,
  contractAddress
);
await verification.verify();

// Check verification status
console.log(verification.status);
```

## Logging

`lib-sourcify` has a basic logging system

You can specify the log level using the `setLibSourcifyLoggerLevel(level)` where:

- `0` is nothing
- `1` is errors
- `2` is warnings _[default]_
- `3` is infos
- `4` is debug

You can override the logger by calling `setLogger(logger: ILibSourcifyLogger)`. This is an example:

```javascript
const winston = require('winston');
const logger = winston.createLogger({
  // ...
});

setLibSourcifyLogger({
  logLevel: 4,
  setLevel(level: number) {
    this.logLevel = level;
  },
  log(level, msg) {
    if (level <= this.logLevel) {
      switch (level) {
        case 1:
          logger.error(msg);
          break;
        case 2:
          logger.warn(msg);
          break;
        case 3:
          logger.info(msg);
          break;
        case 4:
          logger.debug(msg);
          break;
      }
    }
  },
});
```

## Migration Guide from v1 to v2

Version 2 of lib-sourcify brings a significant redesign of the library's architecture. Here's how to migrate from v1 to v2:

### Key Changes

1. **Class Structure Changes**:
   - `AbstractCheckedContract` is replaced by language-specific compilation classes
   - `SolidityCheckedContract` functionality is now split between `SolidityMetadataContract` and `SolidityCompilation`
   - `VyperCheckedContract` is now represented by `VyperCompilation`
   - New `Verification` class handles the verification process

2. **Workflow Changes**:
   - Validation, compilation, and verification are now separate steps
   - More explicit control over the verification process

### Migration Examples

#### From v1: Using SolidityCheckedContract

```typescript
// V1 code
const checkedContracts = await checkFilesWithMetadata(solc, pathBuffers);
const solidityCheckedContract = checkedContracts[0];
await solidityCheckedContract.fetchMissing();
const match = await verifyDeployed(
  solidityCheckedContract,
  sourcifyChain,
  contractAddress
);
```

#### To v2: Using SolidityMetadataContract and Verification

```typescript
// V2 code
import { createMetadataContractsFromFiles, Verification } from "@ethereum-sourcify/lib-sourcify";

// Create metadata contracts from files
const metadataContracts = await createMetadataContractsFromFiles(pathBuffers);
const metadataContract = metadataContracts[0];

// Fetch missing sources
await metadataContract.fetchMissing();

// Create compilation
const compilation = await metadataContract.createCompilation(solc);

// Create verification instance
const verification = new Verification(
  compilation,
  sourcifyChain,
  contractAddress
);

// Perform verification
await verification.verify();

// Check verification status
const status = verification.status;
```

### Function Mapping

| v1 Function/Class | v2 Equivalent |
|-------------------|---------------|
| `SolidityCheckedContract` | `SolidityMetadataContract` + `SolidityCompilation` |
| `VyperCheckedContract` | `VyperCompilation` |
| `checkFilesWithMetadata` | `createMetadataContractsFromFiles` |
| `verifyDeployed` | `Verification.verify()` |
| `fetchMissing` | `metadataContract.fetchMissing()` |
| `isValid` | `metadataContract.isCompilable()` |
