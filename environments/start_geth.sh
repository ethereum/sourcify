#!/bin/bash
set -e
geth init genesis.json
geth --syncmode "full" --goerli
