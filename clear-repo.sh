#Clear all docker images that don't have a tag

docker rmi $(docker images | grep -w 'ethereum/source-verify.*<none>')

docker system prune ## clear all images and containers that are not used
