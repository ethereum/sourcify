#!/bin/bash

source /app/.env
/usr/local/bin/ipfs name publish `/usr/local/bin/ipfs add -Q -r /app/repository`
