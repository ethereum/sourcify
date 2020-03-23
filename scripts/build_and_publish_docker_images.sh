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

curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/environments/base.yaml > environments/base.yaml && \
curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/environments/localchain.yaml > environments/localchain.yaml && \
curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/environments/s3.yaml > environments/s3.yaml && \
curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/environments/.env.${TAG} > environments/.env && \
cd environments && \

docker login --username $DOCKER_USER --password $DOCKER_PASS
docker-compose -f base.yaml -f s3.yaml -f localchain.yaml -f build.yaml build --parallel
docker-compose -f base.yaml -f build.yaml push
