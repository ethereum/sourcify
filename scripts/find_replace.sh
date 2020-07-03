#!/bin/bash
set -e

gpg --yes --batch --passphrase=$SECRET_KEY ../environments/.env.secrets.gpg
source ../environments/.env.secrets
pwd
search="AWS_ACCESS_KEY_ID=xxx"
replace="AWS_ACCESS_KEY_ID=$ACCESS_KEY"
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

search="INFURA_ID=xxx"
replace="INFURA_ID=$INFURA_ID"
sed -i "s/${search}/${replace}/g" ../environments/.env.$TAG

search="ENS_SECRET=xxx"
replace="ENS_SECRET=$ENS_SECRET"
sed -i "s/${search}/${replace}/g" ../environments/.env.$TAG

cp ../environments/.env.$TAG ../environments/.env
rm ../environments/.env.secrets