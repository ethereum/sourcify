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

curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/environments ./environments && cd environments && \

docker login --username $DOCKER_USER --password $DOCKER_PASS
docker-compose -f base.yaml -f build --no-cache --parallel
docker-compose -f base.yaml -f build.yaml push
