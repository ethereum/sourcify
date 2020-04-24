#!/bin/bash
source /app/.env
echo $PATH
export PATH=~$PATH:/usr/local/bin:/usr/local/openjdk-11/bin
echo $PATH

export JAVA_HOME=/usr/local/openjdk-11/

ipfs name publish `ipfs add -Q -r /app/repository`
/app/source_verify_ens_updater/bin/source_verify_ens_updater "key" /app/repository
