#!/bin/bash
set -e

# If not staging and master branch are existing
export TAG="$CIRCLE_BRANCH"

if [ "$CIRCLE_BRANCH" == "staging" ]; then
    export TAG="latest"
    cp .env.latest .env
    echo $TAG
fi

if [ "$CIRCLE_BRANCH" == "master" ]; then
    export TAG="stable";
    cp .env.build .env
    echo $TAG
fi

echo $TAG

docker login --username $DOCKER_USER --password $DOCKER_PASS
docker-compose -f docker-compose-build.yaml build
docker-compose -f docker-compose-build.yaml push
