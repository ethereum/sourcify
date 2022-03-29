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

echo $TAG
echo $SERVICE

# To pass variables React build time in build-ui.yaml
cp environments/.env.$TAG environments/.env

docker login --username $DOCKER_USER --password $DOCKER_PASS
docker-compose -f environments/build-$SERVICE.yaml build
docker push ethereum/source-verify:$SERVICE-$TAG
