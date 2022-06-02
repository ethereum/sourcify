#!/bin/bash
set -e

source ~/.profile

cd scripts/
gpg --yes --batch --passphrase=$SECRET_KEY ../environments/.env.secrets.gpg
gpg --yes --batch --passphrase=$SECRET_KEY ../services/ipfs/ipfs-stable.key.gpg
gpg --yes --batch --passphrase=$SECRET_KEY ../services/ipfs/ipfs-latest.key.gpg
source ../environments/.env.secrets

TAG="$CIRCLE_BRANCH"

if [ "$CIRCLE_BRANCH" == "staging" ]; then
    TAG="latest"
    INFURA_ID=$INFURA_ID_STAGING
    ALCHEMY_ID=$ALCHEMY_ID_STAGING
    IPFS_SECRET=$IPFS_SECRET_STAGING
    PUBLIC_IP=$PUBLIC_IP_STAGING
    LOCAL_IP=$LOCAL_IP_STAGING
    SESSION_SECRET=$SESSION_SECRET_STAGING
    POSTGRES_USER=$POSTGRES_USER_STAGING
    POSTGRES_PASSWORD=$POSTGRES_PASSWORD_STAGING
    ALCHEMY_ID_OPTIMISM=$ALCHEMY_ID_OPTIMISM_STAGING
    ALCHEMY_ID_ARBITRUM=$ALCHEMY_ID_ARBITRUM_STAGING
fi

if [ "$CIRCLE_BRANCH" == "master" ]; then
    TAG="stable";
    INFURA_ID=$INFURA_ID_MASTER
    ALCHEMY_ID=$ALCHEMY_ID_MASTER
    IPFS_SECRET=$IPFS_SECRET_MASTER
    PUBLIC_IP=$PUBLIC_IP_MASTER
    LOCAL_IP=$LOCAL_IP_MASTER
    SESSION_SECRET=$SESSION_SECRET_MASTER
    POSTGRES_USER=POSTGRES_USER_MASTER
    POSTGRES_PASSWORD=POSTGRES_PASSWORD_MASTER
    ALCHEMY_ID_OPTIMISM=$ALCHEMY_ID_OPTIMISM_MASTER
    ALCHEMY_ID_ARBITRUM=$ALCHEMY_ID_ARBITRUM_MASTER
fi

for VAR_NAME in INFURA_ID ALCHEMY_ID AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY IPFS_SECRET NPM_TOKEN ENS_SECRET PUBLIC_IP LOCAL_IP SESSION_SECRET POSTGRES_USER POSTGRES_PASSWORD ALCHEMY_ID_OPTIMISM ALCHEMY_ID_ARBITRUM
do
    echo "find_repace.sh: replacing $VAR_NAME"
    VAR_VAL=$(eval "echo \${$VAR_NAME}")
    # Use @ as delimiter instead of / as values may contain / but @ is unlikely
    sed -i "s@${VAR_NAME}=xxx@${VAR_NAME}=${VAR_VAL}@g" ../environments/.env.$TAG
done

cp ../environments/.env.$TAG ../environments/.env
rm ../environments/.env.secrets
