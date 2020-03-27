#!/bin/bash
set -e
echo ${NETWORK_NAME}
#geth init genesis.json
geth --syncmode "full" --${NETWORK_NAME}
