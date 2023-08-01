#!/bin/bash
set -e

source ~/.profile

cd scripts/
gpg --yes --batch --passphrase=$SECRET_KEY ../environments/.env.secrets.gpg
gpg --yes --batch --passphrase=$SECRET_KEY ../services/ipfs/server/ipfs-stable.key.gpg
gpg --yes --batch --passphrase=$SECRET_KEY ../services/ipfs/server/ipfs-latest.key.gpg
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
    ALCHEMY_ID_OPTIMISM=$ALCHEMY_ID_OPTIMISM_STAGING
    ALCHEMY_ID_ARBITRUM=$ALCHEMY_ID_ARBITRUM_STAGING
    CHAINSAFE_S3_ACCESS_KEY_ID=$CHAINSAFE_S3_ACCESS_KEY_ID_STAGING
    CHAINSAFE_S3_SECRET_ACCESS_KEY=$CHAINSAFE_S3_SECRET_ACCESS_KEY_STAGING
    ESTUARY_PINNING_SECRET=$ESTUARY_PINNING_SECRET_STAGING
    WEB3_STORAGE_PINNING_SECRET=$WEB3_STORAGE_PINNING_SECRET_STAGING
    FALLBACK_IPFS_GATEWAY=$FALLBACK_IPFS_GATEWAY_STAGING
    CREATE2_CLIENT_TOKENS=$CREATE2_CLIENT_TOKENS_STAGING
    GRAFANA_HTTP_USER=$GRAFANA_HTTP_USER_STAGING
    GRAFANA_HTTP_PASS=$GRAFANA_HTTP_PASS_STAGING
    ETHERSCAN_API_KEY=$ETHERSCAN_API_KEY_STAGING
    ARBISCAN_API_KEY=$ARBISCAN_API_KEY_STAGING
    POLYGONSCAN_API_KEY=$POLYGONSCAN_API_KEY_STAGING
    BSCSCAN_API_KEY=$BSCSCAN_API_KEY_STAGING
    SNOWTRACE_API_KEY=$SNOWTRACE_API_KEY_STAGING
    CELOSCAN_API_KEY=$CELOSCAN_API_KEY_STAGING
    MOONSCAN_MOONBEAM_API_KEY=$MOONSCAN_MOONBEAM_API_KEY_STAGING
    MOONSCAN_MOONRIVER_API_KEY=$MOONSCAN_MOONRIVER_API_KEY_STAGING
    BOBASCAN_API_KEY=$BOBASCAN_API_KEY_STAGING
    GNOSISSCAN_API_KEY=$GNOSISSCAN_API_KEY_STAGING
    OPTIMISMSCAN_API_KEY=$OPTIMISMSCAN_API_KEY_STAGING
    CRONOSCAN_API_KEY=$CRONOSCAN_API_KEY_STAGING
    BASESCAN_API_KEY=$BASESCAN_API_KEY_STAGING
fi

if [ "$CIRCLE_BRANCH" == "master" ]; then
    TAG="stable";
    INFURA_ID=$INFURA_ID_MASTER
    ALCHEMY_ID=$ALCHEMY_ID_MASTER
    IPFS_SECRET=$IPFS_SECRET_MASTER
    PUBLIC_IP=$PUBLIC_IP_MASTER
    LOCAL_IP=$LOCAL_IP_MASTER
    SESSION_SECRET=$SESSION_SECRET_MASTER
    ALCHEMY_ID_OPTIMISM=$ALCHEMY_ID_OPTIMISM_MASTER
    ALCHEMY_ID_ARBITRUM=$ALCHEMY_ID_ARBITRUM_MASTER
    CHAINSAFE_S3_ACCESS_KEY_ID=$CHAINSAFE_S3_ACCESS_KEY_ID_MASTER
    CHAINSAFE_S3_SECRET_ACCESS_KEY=$CHAINSAFE_S3_SECRET_ACCESS_KEY_MASTER
    ESTUARY_PINNING_SECRET=$ESTUARY_PINNING_SECRET_MASTER
    WEB3_STORAGE_PINNING_SECRET=$WEB3_STORAGE_PINNING_SECRET_MASTER
    FALLBACK_IPFS_GATEWAY=$FALLBACK_IPFS_GATEWAY_MASTER
    CREATE2_CLIENT_TOKENS=$CREATE2_CLIENT_TOKENS_MASTER
    GRAFANA_HTTP_USER=$GRAFANA_HTTP_USER_MASTER
    GRAFANA_HTTP_PASS=$GRAFANA_HTTP_PASS_MASTER
    ETHERSCAN_API_KEY=$ETHERSCAN_API_KEY_MASTER
    ARBISCAN_API_KEY=$ARBISCAN_API_KEY_MASTER
    POLYGONSCAN_API_KEY=$POLYGONSCAN_API_KEY_MASTER
    BSCSCAN_API_KEY=$BSCSCAN_API_KEY_MASTER
    SNOWTRACE_API_KEY=$SNOWTRACE_API_KEY_MASTER
    CELOSCAN_API_KEY=$CELOSCAN_API_KEY_MASTER
    MOONSCAN_MOONBEAM_API_KEY=$MOONSCAN_MOONBEAM_API_KEY_MASTER
    MOONSCAN_MOONRIVER_API_KEY=$MOONSCAN_MOONRIVER_API_KEY_MASTER
    BOBASCAN_API_KEY=$BOBASCAN_API_KEY_MASTER
    GNOSISSCAN_API_KEY=$GNOSISSCAN_API_KEY_MASTER
    OPTIMISMSCAN_API_KEY=$OPTIMISMSCAN_API_KEY_MASTER
    CRONOSCAN_API_KEY=$CRONOSCAN_API_KEY_MASTER
    BASESCAN_API_KEY=$BASESCAN_API_KEY_MASTER
fi

for VAR_NAME in INFURA_ID ALCHEMY_ID CF_ACCESS_CLIENT_ID CF_ACCESS_CLIENT_SECRET AWS_S3_ACCESS_KEY_ID AWS_S3_SECRET_ACCESS_KEY IPFS_SECRET NPM_TOKEN PUBLIC_IP LOCAL_IP SESSION_SECRET ALCHEMY_ID_OPTIMISM ALCHEMY_ID_ARBITRUM CHAINSAFE_S3_ACCESS_KEY_ID CHAINSAFE_S3_SECRET_ACCESS_KEY ESTUARY_PINNING_SECRET WEB3_STORAGE_PINNING_SECRET FALLBACK_IPFS_GATEWAY CREATE2_CLIENT_TOKENS GRAFANA_HTTP_USER GRAFANA_HTTP_PASS ETHERSCAN_API_KEY ARBISCAN_API_KEY POLYGONSCAN_API_KEY BSCSCAN_API_KEY SNOWTRACE_API_KEY CELOSCAN_API_KEY MOONSCAN_MOONBEAM_API_KEY MOONSCAN_MOONRIVER_API_KEY BOBASCAN_API_KEY GNOSISSCAN_API_KEY OPTIMISMSCAN_API_KEY CRONOSCAN_API_KEY BASESCAN_API_KEY
do
    echo "find_repace.sh: replacing $VAR_NAME"
    VAR_VAL=$(eval "echo \${$VAR_NAME}")
    # Use @ as delimiter instead of / as values may contain / but @ is unlikely
    # sed on MacOS has different syntax. Install "gsed" with brew install gnu-sed and replace when developing on MacOS
    sed -i "s@${VAR_NAME}=xxx@${VAR_NAME}=${VAR_VAL}@g" ../environments/.env.$TAG
done

cp ../environments/.env.$TAG ../environments/.env
rm ../environments/.env.secrets
