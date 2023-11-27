# Changelog for `@ethereum-sourcify/lib-sourcify`

All notable changes to this project will be documented in this file.

## [@ethereum-sourcify/lib-sourcify@1.6.0] - 2023-11-23

- Remove solc as a dependency, now it must be included implementing the `ISolidityCompiler` interface
- fix `extra-file-input-bug`

## [@ethereum-sourcify/lib-sourcify@1.5.0] - 2023-11-03

- Remove solc as a dependency, now the solidity compiler needs to be passed to the functions using it.
- Rename deployedBytecode into runtimeBytecode
- Use `fetchContractCreationTxUsing` object to scrape
- Always compile with emscripten for nightlies and versions <0.4.10
- Support creationMatch vs runtimeMatch

## [@ethereum-sourcify/lib-sourcify@1.4.2] - 2023-10-19

- Bump to sync the tags on master

## [@ethereum-sourcify/lib-sourcify@1.4.1] - 2023-10-18

- Remove `typeRoots` from `tsconfig.json`

## [@ethereum-sourcify/lib-sourcify@1.4.0] - 2023-10-09

- Bump `ethers` to `6.7.1`
- Bump `solc` to `0.8.21`
- Split `MetadataSources` type to `MetadataSourceMap` and `MetadataSource`
- Remove package-lock.json as it is managed by root package.json by lerna

## [@ethereum-sourcify/lib-sourcify@1.3.2] - 2023-09-04

- Use `https://binaries.soliditylang.org` instead of `https://github.com/ethereum/solc-bin/raw/gh-pages` for Solidity compiler binaries

## Older releases

Previously, the releases were not done one separate modules of Sourcify but for the repository as a whole.
You can find the changelog for those releases in [older releases](https://github.com/ethereum/sourcify/releases) for this repository.
