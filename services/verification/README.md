# Sourcify Verification 🧑‍💻📝🔍

The Sourcify Verification module is intended to help you recompile and check if the deployed contract matches your sources.  
If you want to validate your sources first and see if they are viable please use `@ethereum-sourcify/validation` module.

## Overview

This module exports two classes, `VerificationService` and `Injector`.  
`Injector` is the brain of this module, it can recompile, verify and store verified contracts in the repository.  
If you are building a project that will check sources for some addresses multiple times, use the `VerificationService` class which offers you option to check if contract with the desired address is already verified and stored inside your repository.

## Usage as a module

- `npm install @ethereum-sourcify/verification`

### Injector

`Injector` constructor receives `InjectorConfig`:

```typescript
interface InjectorConfig {
  alchemyPID?: string; // Alchemy project ID
  silent?: boolean;
  log?: bunyan; // bunyan logger (optional)
  offline?: boolean;
  repositoryPath?: string; // desired path to save verified contracts (default is "./repository")
  fileService?: FileService; // fileService from the @ethereum-sourcify/core (optional)
}
```

`Injector` has one public method `inject` that recieves `InjectorInput` object consisting of data to be verified.

```typescript
interface InjectorInput {
  chain: string; // id of the Ethereum network with deployed contract
  addresses: string[]; // For now only one address is supported
  contracts: CheckedContract[]; // Solidity and metadata files
  bytecode?: string; // If you already have bytecode of the deployed contract
}
```

Files object in the `InjectorInput` consists of `metadata` and `solidity` properties where `metadata` is `.json` file outputed by the compiler and `solidity` is the entire smart contract in a string format.

```json
{
  "metadata": {},
  "solidity": {}
}
```

#### Usage:

```typescript
import { Injector } from "@ethereum-sourcify/verification";

const injector = await Injector.createAsync(injectorConfig);

const result = await injector.inject(injectorInput);
```

Result of this snippet is the object: `{ address: "0x...", status: "perfect"|"partial" }` and source files saved hierarchicaly.  
For example full match on the mainnet would be saved inside ./repository/contracts/full_match/1/0x.../

### VerificationService

VerificationService can receive `fileService` from `@ethereum-sourcify/core` module if desired. Otherwise, it creates the default `fileService` which creates the repository in the current working directory.  
There are two available methods: `findByAddress` and `inject`.

`inject` method only wraps `Injector.inject` method and also receives `InjectorInput` as an argument.  
`findByAddress` is used to perform "light check" in your repository and look if there are already saved sources for the desired address and chain.

```typescript
import { VerificationService } from "@ethereum-sourcify/verification";

const verificationService = new VerificationService();

const result = await verificationService.findByAddress(
  address,
  chain,
  repositoryPath
); // Returns the object { address: "0x...", status: "perfect" } if found

if (!result.length) {
  result = await verificationService.inject(injectorInput); // If the contract is not found in the repository, call injector and verify sources
}
```
