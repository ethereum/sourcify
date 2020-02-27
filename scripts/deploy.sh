#!/bin/bash
set -e

# If not staging or master branch are existing
export TAG="$CIRCLE_BRANCH"

if [ "$CIRCLE_BRANCH" == "feature-CD" ]; then 
    export TAG="latest"
    export REPO_PATH='/opt/source-verify/staging/source-verify/'
    echo $TAG
fi

if [ "$CIRCLE_BRANCH" == "staging" ]; then 
    export TAG="latest"
    export REPO_PATH='/opt/source-verify/staging/source-verify/'
    echo $TAG
fi

if [ "$CIRCLE_BRANCH" == "master" ]; then
    export TAG="stable"; 
    export REPO_PATH='/opt/source-verify/master/source-verify/'
    echo $TAG
fi

echo $TAG
# Do ssh to server
ssh -o "StrictHostKeyChecking no" source-verify@komputing.org "\
mkdir -p $REPO_PATH && \
cd $REPO_PATH && \
curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/docker-compose-prod.yaml > docker-compose.yaml && \
docker-compose pull && \
echo $TAG && \
source .env && TAG=$TAG docker-compose up -d"
