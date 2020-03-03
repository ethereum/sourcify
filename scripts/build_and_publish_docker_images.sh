#!/bin/bash
set -e

# If not staging and master branch are existing
export TAG="$CIRCLE_BRANCH"

if [ "$CIRCLE_BRANCH" == "staging" ]; then
    export TAG="latest"
    echo $TAG
fi

if [ "$CIRCLE_BRANCH" == "master" ]; then
    export TAG="stable";
    echo $TAG
fi

echo $TAG

curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/docker-compose-build.yaml > docker-compose.yaml
curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/.env.${TAG} > .env

docker login --username $DOCKER_USER --password $DOCKER_PASS
cp .env.${TAG} .env
source .env && docker-compose -f docker-compose-build.yaml build --no-cache --parallel
source .env && docker-compose -f docker-compose-build.yaml push
