#!/bin/bash
set -e

mkdir -p $REPO_PATH
cd $REPO_PATH
rm -rf source-verify
git clone https://github.com/ethereum/source-verify.git
git checkout ${CIRCLE_BRANCH}
cd source-verify/environments
./find_replace.sh
