#!/bin/sh

if [ $# != 3 ]
then
    echo "Usage: $0 <port> <repository location> <db location>"
    exit 1
fi

docker build -t ethereum/source-verify .
docker run -v "$2":/repository ethereum/source-verify ./scripts/run_monitor.sh &
docker run -p "$1":80 -v "$2":/repository -v "$3":/db ethereum/source-verify ./scripts/run_server.sh 2>&1 | tee server.log &
