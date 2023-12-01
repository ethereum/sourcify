#!/bin/bash
set -e

echo $SERVICE

# To pass variables React build time in build-ui.yaml
if [ "$SERVICE" == "ui" ]; then
    if [ -n "$CIRCLE_BRANCH" ]; then
        cp ui/.env.build.$CIRCLE_BRANCH ui/.env
    elif [ -n "$CIRCLE_TAG" ]; then
        cp ui/.env.build.master ui/.env
    fi
fi

NAMESPACE="ghcr.io/ethereum/sourcify"
IMAGE_NAME="$NAMESPACE/$SERVICE"
# Login to Github Container Registry
echo $GITHUB_CR_PAT | docker login ghcr.io --username kuzdogan --password-stdin

# Triggered by a branch
# e.g. sourcify/server:master
if [ -n "$CIRCLE_BRANCH" ]; then
    TAGGED_IMAGE_NAME="$IMAGE_NAME:$CIRCLE_BRANCH"
    TAG_COMMAND="-t $TAGGED_IMAGE_NAME"
fi

# Triggered by a tag (release)
# e.g. sourcify/server:latest  &  sourcify/server:0.1.0
if [ -n "$CIRCLE_TAG" ]; then
    # Assuming CIRCLE_TAG is something like "sourcify-monitor@1.1.3"
    # Extract the version number after the last '@'
    VERSION=${CIRCLE_TAG##*@}
    TAGGED_IMAGE_NAME="$IMAGE_NAME:$VERSION"
    TAG_COMMAND="-t $IMAGE_NAME:latest -t $TAGGED_IMAGE_NAME"
fi

# Create a new builder instance
# Comment out if already created
# docker buildx create --name sourcify-builder --use

# # Start up the builder instance
# docker buildx inspect --bootstrap

# Build the image for multiple platforms with buildx
# Tag is without "ethereum": "sourcify/$SERVICE:$TAG" but label with the repo url "ethereum/sourcify"
# docker buildx build \
#     --platform linux/arm64,linux/amd64 \
docker build \
    -f $DOCKERFILE \
    $TAG_COMMAND \
    $DOCKER_BUILD_CONTEXT \

docker push $TAGGED_IMAGE_NAME


# No need to extract the image tag if the build is triggered by a tag because the deployment will be done by the branch trigger.
if [ -n "$CIRCLE_TAG" ]; then
    exit 0
fi

# Get the tag of the built image
image_tag=$(docker inspect --format='{{index .RepoDigests 0}}' $TAGGED_IMAGE_NAME | cut -d'@' -f2)
echo "Image tag: $image_tag"

mkdir -p workspace
echo "Writing image tag $image_tag to workspace/"$SERVICE"_image_tag.txt"
echo -n $image_tag > workspace/"$SERVICE"_image_tag.txt
echo "Written image tag $image_tag to workspace/"$SERVICE"_image_tag.txt"