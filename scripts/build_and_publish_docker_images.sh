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
if [ "$SERVICE" == "ui" ]; then
    cp ui/.env.build.$TAG ui/.env
fi

docker login --username $DOCKER_USER --password $DOCKER_PASS
docker-compose -f environments/build-$SERVICE.yaml build
docker push ethereum/source-verify:$SERVICE-$TAG

# Get the tag of the built image
image_tag=$(docker inspect --format='{{index .RepoDigests 0}}' ethereum/source-verify:$SERVICE-$TAG | cut -d'@' -f2)
echo "Image tag: $image_tag"

mkdir -p workspace
echo "Writing image tag $image_tag to workspace/"$SERVICE"_image_tag.txt"
echo -n $image_tag > workspace/"$SERVICE"_image_tag.txt
echo "Written image tag $image_tag to workspace/"$SERVICE"_image_tag.txt"