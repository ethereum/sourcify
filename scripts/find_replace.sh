#!/bin/bash
set -e

source ~/.profile

cd scripts/
gpg --yes --batch --passphrase=$SECRET_KEY ../environments/.env.secrets.gpg
gpg --yes --batch --passphrase=$SECRET_KEY ../services/ipfs/ipfs-stable.key.gpg
gpg --yes --batch --passphrase=$SECRET_KEY ../services/ipfs/ipfs-latest.key.gpg
source ../environments/.env.secrets
pwd

export TAG="$CIRCLE_BRANCH"

if [ "$CIRCLE_BRANCH" == "staging" ]; then
    export TAG="latest"
    export INFURA_ID=$INFURA_ID_STAGING
    export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID_STAGING
    export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY_STAGING
    export IPFS_SECRET=$IPFS_SECRET_STAGING
fi

if [ "$CIRCLE_BRANCH" == "master" ]; then
    export TAG="stable";
    export INFURA_ID=$INFURA_ID_MASTER
    export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID_MASTER
    export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY_MASTER
    export IPFS_SECRET=$IPFS_SECRET_MASTER
fi

search="INFURA_ID=xxx"
replace="INFURA_ID=$INFURA_ID"
sed -i "s/${search}/${replace}/g" ../environments/.env.$TAG

search="AWS_ACCESS_KEY_ID=xxx"
replace="AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID"
sed -i "s/${search}/${replace}/g" ../environments/.env.$TAG

search="AWS_SECRET_ACCESS_KEY=xxx"
replace="AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY"
sed -i "s/${search}/${replace}/g" ../environments/.env.$TAG

search="IPFS_SECRET=xxx"
replace="IPFS_SECRET=$IPFS_SECRET"
sed -i "s/${search}/${replace}/g" ../environments/.env.$TAG

search="NPM_TOKEN=xxx"
replace="NPM_TOKEN=$NPM_TOKEN"
sed -i "s/${search}/${replace}/g" ../environments/.env.$TAG

search="ENS_SECRET=xxx"
replace="ENS_SECRET=$ENS_SECRET"
sed -i "s/${search}/${replace}/g" ../environments/.env.$TAG

cp ../environments/.env.$TAG ../environments/.env
rm ../environments/.env.secrets
