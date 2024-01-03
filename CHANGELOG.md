# Changelog for `sourcify-monorepo`

All notable changes to this project will be documented in this file.

This CHANGELOG will contain monorepo related changes such as CI configs, shared dependencies and the development setup.

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
- Move Typscript to root `package.json` and remove it from all subpackages
- Add `printWidth` to `.prettierrc`

## Older releases

Previously, the releases were not done one separate modules of Sourcify but for the repository as a whole.
You can find the changelog for those releases in [older releases](https://github.com/ethereum/sourcify/releases) for this repository.
