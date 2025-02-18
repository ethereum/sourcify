# Changelog for `sourcify-monorepo`

All notable changes to this project will be documented in this file.

This CHANGELOG will contain monorepo related changes such as CI configs, shared dependencies and the development setup.

## sourcify-monorepo@1.4.7 - 2025-02-18

Simplify chain tests commands

## sourcify-monorepo@1.4.6 - 2025-02-06

- Fix not publishing to npm and throw on errors in the bash scripts

## sourcify-monorepo@1.4.5 - 2025-01-08

- Add Vyper descriptions to README
- Add Mocha - bytecode-utils VSCode debugging suite
- Remove lambda compiler
- Update release script
- Update dependencies

## sourcify-monorepo@1.4.4 - 2024-12-11

- Update dependencies

## sourcify-monorepo@1.4.3 - 2024-10-29

- Publish sourcify-server to npm on CI runs
- Turn off S3 backup check tests temporarily
- Update packages

## sourcify-monorepo@1.4.2 - 2024-10-14

- Build before testing in CI
- Update release process
- Remove build and debug from VSCode launch.json
- Run cli.js instead of server.js
- Update packages
- Add script to rename files with .sol in repoV2 to without file extension

## sourcify-monorepo@1.4.1 - 2024-09-17

- Increase GCP deploy step timeout
- Update .gitignore and .nxignore

## sourcify-monorepo@1.4.0 - 2024-08-29

- Remove UI and all related CI/CD code
- Add GCP deployment to CI/CD
- Update packages
- Update h5ai-nginx link

## sourcify-monorepo@1.3.0 - 2024-07-25

- Use Node 22.4.0 everywhere
- Update CircleCI base images and orbs
- Add codecov support in CircleCI
- Remove contract-call-decoder module
- Add nx to .gitignore
- Add lerna run fix as npm script
- Upgrade dependencies
- Add Renovate to manage dependency updates
- Update verify-massively.msj script

## sourcify-monorepo@1.2.10 - 2024-05-28

- fix CircleCI new_branch and nightly scripts to support database

## sourcify-monorepo@1.2.9 - 2024-05-14

- fix .vscode/launch.json 
- update package-lock.json
- update h5ai-nginx

## sourcify-monorepo@1.2.8 - 2024-04-23

- Skip npm-publish if not a package
- s3-backup-check on master only
- Add the release script

## sourcify-monorepo@1.2.7 - 2024-04-04

- Update dependencies

## sourcify-monorepo@1.2.6 - 2024-04-04

- Update dependencies

## sourcify-monorepo@1.2.5 - 2024-03-28

- Update dependencies
- Add Postgres DB env vars to the CI

## sourcify-monorepo@1.2.4 - 2024-03-15

- Update sourcify-server

## sourcify-monorepo@1.2.3 - 2024-03-14

- Update dependencies

## sourcify-monorepo@1.2.2 - 2024-02-26

- Fix `fsevents` as an optional dependency for Linux builds

## sourcify-monorepo@1.2.1 - 2024-02-22

- Assign resources to CI jobs for faster runs (when 100% CPU) or cheaper runs
- Add a DB container to the tests
- Don't run full tests in `test-new-chains` if no `NEW_CHAIN_ID` is set
- Support both `add-new-chain-{chainIds}` and `add-new-chains-{chainIds}` as branch names for new chains
- Add `fsevents` as an optional dependency for Linux builds

## sourcify-monorepo@1.2.0 - 2024-01-04

- Add multiarch image builds
- Adjust resources for CI builds. This should speed up the builds and reduce the usage for unnecessary resources.
- Optimize some runs by not install and building unless necessary

## sourcify-monorepo@1.1.2 - 2024-01-03

- Update `FUNDING.json`
- Add arm64 build runs to CI but turn them off for now

## sourcify-monorepo@1.1.1 - 2023-12-19

- Fix tagged builds not being triggered because they are not in the entrypoint circleci YML file.
- Fix `latest` tag not being pushed to Docker Hub.

## sourcify-monorepo@1.1.0 - 2023-12-19

- Move CI scripts to `.circleci/scripts`
- Change CircleCI config:
  - Always run all images instead of only the changed ones
  - Add a new tagged_build_and_publish that gets triggered on new tags
  - build_and_publish_docker_images accroding to the new container and versioning setup
- Remove `environments` folder
- Remove unused env vars from `.vscode/launch.json`
- Move Typescript to root `package.json` and remove it from all subpackages
- Add `printWidth` to `.prettierrc`

## Older releases

Previously, the releases were not done one separate modules of Sourcify but for the repository as a whole.
You can find the changelog for those releases in [older releases](https://github.com/ethereum/sourcify/releases) for this repository.
