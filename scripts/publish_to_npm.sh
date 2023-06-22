#!/bin/bash

BYTECODE_UTILS_LOCAL_VERSION=$(cat packages/bytecode-utils/package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')

BYTECODE_UTILS_NPM_VERSION=$(npm view @ethereum-sourcify/bytecode-utils dist-tags.latest)

CONTRACT_CALL_DECODER_LOCAL_VERSION=$(cat packages/contract-call-decoder/package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')

CONTRACT_CALL_DECODER_NPM_VERSION=$(npm view @ethereum-sourcify/contract-call-decoder dist-tags.latest)

LIB_SOURCIFY_LOCAL_VERSION=$(cat packages/lib-sourcify/package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')

LIB_SOURCIFY_NPM_VERSION=$(npm view @ethereum-sourcify/lib-sourcify dist-tags.latest)

npm config set //registry.npmjs.org/:_authToken=${NPM_TOKEN}

if [ $BYTECODE_UTILS_LOCAL_VERSION = $BYTECODE_UTILS_NPM_VERSION ]; then
    echo "@ethereum-sourcify/bytecode-utils:"
    echo "Latest npm version is equal to current package version. Up the version to publish to npm."
else
    npm publish packages/bytecode-utils/ --verbose --access=public
fi

if [ $CONTRACT_CALL_DECODER_LOCAL_VERSION = $CONTRACT_CALL_DECODER_NPM_VERSION ]; then
    echo "@ethereum-sourcify/contract-call-decoder:"
    echo "Latest npm version is equal to current package version. Up the version to publish to npm."
else
    npm publish packages/contract-call-decoder/ --verbose --access=public
fi

if [ $LIB_SOURCIFY_LOCAL_VERSION = $LIB_SOURCIFY_NPM_VERSION ]; then
    echo "@ethereum-sourcify/lib-sourcify:"
    echo "Latest npm version is equal to current package version. Up the version to publish to npm."
else
    npm publish packages/lib-sourcify/ --verbose --access=public
fi