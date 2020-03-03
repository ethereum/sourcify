#!/bin/bash
set -e

# If not staging and master branch are existing
export TAG="$CIRCLE_BRANCH"

if [ "$CIRCLE_BRANCH" == "staging" ]; then
    export TAG="latest"
fi

if [ "$CIRCLE_BRANCH" == "master" ]; then
    export TAG="stable";
fi

if [ "$CIRCLE_BRANCH" == "volumes-read-write-config" ]; then
    export TAG="testing"
fi

echo $TAG

cd environments && cp .env.$TAG .env
echo $SERVICE

docker login --username $DOCKER_USER --password $DOCKER_PASS
rm .env
cp .env.${TAG} .env
source .env && docker-compose -f docker-compose-build.yaml build --no-cache --parallel
source .env && docker-compose -f docker-compose-build.yaml push
