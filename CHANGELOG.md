# Changelog for `sourcify-server`

All notable changes to this project will be documented in this file.

## [sourcify-server@1.1.0] - 2023-09-04

- Updated lerna to `7.1.5`
- #1158 Add `REPOSITORY_URL_HOST` env variable to `sourcify-server` to allow for custom repository paths in containers. Previously this was hardcoded as `../../data/repository`
- Updates chains.json
- New chains:
  - Kiwi Subnet (2037)
  - Beam Subnet (4337)
  - Amplify Subnet (78430)
  - Bulletin Subnet (78431)
  - Conduit Subnet (78432)

## Older releases

Previously, the releases were not done one separate modules of Sourcify but for the repository as a whole.
You can find the changelog for those releases in [older releases](https://github.com/ethereum/sourcify/releases) for this repository.
