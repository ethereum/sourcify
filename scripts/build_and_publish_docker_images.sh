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

if [ "$CIRCLE_BRANCH" == "volumes-read-write-config" ]; then
    export TAG="test"
    echo $TAG
fi

echo $TAG

cd environments && cp .env.$TAG .env

docker login --username $DOCKER_USER --password $DOCKER_PASS
docker-compose -f geth.yaml -f ipfs.yaml -f localchain.yaml -f monitor.yaml -f repository.yaml -f s3.yaml -f server.yaml -f ui.yaml -f build.yaml build --parallel
docker-compose -f geth.yaml -f ipfs.yaml -f localchain.yaml -f monitor.yaml -f repository.yaml -f s3.yaml -f server.yaml -f ui.yaml -f build.yaml push
