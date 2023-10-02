# Changelog for `sourcify-monitor`

All notable changes to this project will be documented in this file.

## [sourcify-monitor@1.0.0] - 2023-10-03

No changes this release. This marks the start of the changelog for this module.

This was a total rewrite of the sourcify-monitor as a completely isolated module from the sourcify-server. Previously it was sharing the verification logic as well as the filesystem. The new sourcify-monitor will detect contract creations and send them to an existing sourcify server in HTTP requests. See the [README](./README.md) for more information.

## Older releases

Previously, the releases were not done one separate modules of Sourcify but for the repository as a whole.
You can find the changelog for those releases in [older releases](https://github.com/ethereum/sourcify/releases) for this repository.
