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
docker-compose -f $SERVICE.yaml -f build-$SERVICE.yaml build
docker-compose -f $SERVICE.yaml -f build-$SERVICE.yaml push
