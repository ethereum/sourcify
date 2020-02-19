#!/bin/bash
set -e

# If not staging and master branch are existing
TAG="$CIRCLE_BRANCH"

if [ "$CIRCLE_BRANCH" == "staging" ]; then 
    export TAG="latest"
    echo $TAG
fi

if [ "$CIRCLE_BRANCH" == "master" ]; then
    export TAG="stable"; 
    echo $TAG
fi

docker login --username $DOCKER_USER --password $DOCKER_PASS
docker-compose -f docker-compose-build.yaml build --no-cache --parallel --build-arg TAG=$TAG
docker-compose -f docker-compose-build.yaml push
