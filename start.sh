#!/usr/bin/env bash
mkdir repository

echo ${STAGE}
source .env.${STAGE}
docker-compose -f docker-compose-${STAGE}.yaml build --no-cache --parallel
docker-compose -f docker-compose-${STAGE}.yaml up --build -d
