#!/bin/bash

CORE_LOCAL_VERSION=$(cat services/core/package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')

CORE_NPM_VERSION=$(npm view @ethereum-sourcify/core dist-tags.latest)

VALIDATION_LOCAL_VERSION=$(cat services/validation/package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')

VALIDATION_NPM_VERSION=$(npm view @ethereum-sourcify/validation dist-tags.latest)

VERIFICATION_LOCAL_VERSION=$(cat services/verification/package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')

VERIFICATION_NPM_VERSION=$(npm view @ethereum-sourcify/verification dist-tags.latest)

BYTECODE_UTILS_LOCAL_VERSION=$(cat packages/bytecode-utils/package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')

BYTECODE_UTILS_NPM_VERSION=$(npm view @ethereum-sourcify/bytecode-utils dist-tags.latest)

npm config set //registry.npmjs.org/:_authToken=${NPM_TOKEN}

if [ $CORE_LOCAL_VERSION = $CORE_NPM_VERSION ]; then
    echo "@ethereum-sourcify/core:"
    echo "Latest npm version is equal to current package version. Up the version to publish to npm."
else
    npm publish services/core/ --verbose --access=public
fi

if [ $VALIDATION_LOCAL_VERSION = $VALIDATION_NPM_VERSION ]; then
    echo "@ethereum-sourcify/validation:"
    echo "Latest npm version is equal to current package version. Up the version to publish to npm."
else
    npm publish services/validation/ --verbose --access=public
fi

if [ $VERIFICATION_LOCAL_VERSION = $VERIFICATION_NPM_VERSION ]; then
    echo "@ethereum-sourcify/verification:"
    echo "Latest npm version is equal to current package version. Up the version to publish to npm."
else
    npm publish services/verification/ --verbose --access=public
fi

if [ $BYTECODE_UTILS_LOCAL_VERSION = $BYTECODE_UTILS_NPM_VERSION ]; then
    echo "@ethereum-sourcify/bytecode-utils:"
    echo "Latest npm version is equal to current package version. Up the version to publish to npm."
else
    npm publish packages/bytecode-utils/ --verbose --access=public
fi
