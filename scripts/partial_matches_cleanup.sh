#!/bin/bash

# This script is used to remove partial matches for contracts that have been fully verified

REPO_PATH="repository/contracts"

chains_to_check=( `ls ${REPO_PATH}/partial_match` )

for chain in "${chains_to_check[@]}"
do
    echo "Checking partial matches for chainID: ${chain}"
    contracts_to_check=( `ls ${REPO_PATH}/partial_match/${chain}` )
    for contract in "${contracts_to_check[@]}"
    do
        if [ -d "${REPO_PATH}/full_match/${chain}/${contract}" ]; then
            echo "Removing partial match for ${contract} on chainID ${chain}"
            rm -rf "${REPO_PATH}/partial_match/${chain}/${contract}"
        fi
    done
done
