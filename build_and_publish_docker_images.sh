#!/bin/bash
set -e

if [ "$CIRCLE_BRANCH" == "develop" ]; then 
    export TAG="latest"
    echo $TAG
fi

if [ "$CIRCLE_BRANCH" == "master" ]; then
    export TAG="stable"; 
    echo $TAG
fi
echo $TAG

ls -al
cat build_and_publish_docker_images.sh

docker login --username $DOCKER_USER --password $DOCKER_PASS
docker-compose -f docker-compose-build.yaml build --no-cache --parallel --build-arg TAG=$TAG
docker-compose -f docker-compose-build.yaml push
