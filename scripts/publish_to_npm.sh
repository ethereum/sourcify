#!/bin/bash

PACKAGE_VERSION=$(cat package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')

NPM_VERSION=$(npm view ethereum-sourcify/cli dist-tags.latest)

if [ $NPM_VERSION = $PACKAGE_VERSION ]; then
    echo "Latest npm version is equal to current package version. Up the version to publish to npm."
    exit 0
fi


# publish
npm config set //registry.npmjs.org/:_authToken=${NPM_TOKEN}
npm publish --verbose
