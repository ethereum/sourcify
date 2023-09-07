#!/bin/bash
set -e

# If not staging and master branch are existing
export TAG="$CIRCLE_BRANCH"

if [ "$CIRCLE_BRANCH" == "staging" ]; then
    export TAG="latest"
    # Must be added to the $BASH_ENV to be available in the next job steps
    # https://circleci.com/docs/set-environment-variable
    echo 'export TAG="latest"' >> "$BASH_ENV"
fi

if [ "$CIRCLE_BRANCH" == "master" ]; then
    export TAG="stable";
    echo 'export TAG="stable"' >> "$BASH_ENV"
fi

echo $TAG
echo $SERVICE

# To pass variables React build time in build-ui.yaml
cp environments/.env.$TAG environments/.env

docker login --username $DOCKER_USER --password $DOCKER_PASS
docker-compose -f environments/build-$SERVICE.yaml build
docker push ethereum/source-verify:$SERVICE-$TAG

# Get the SHA of the built image
image_sha=$(docker images --no-trunc --format "{{.ID}}" ethereum/source-verify:$SERVICE-$TAG | cut -d':' -f 2)
echo "Image SHA: $image_sha"