#!/bin/bash

source /app/.env
ipfs name publish `ipfs add -Q -r /app/repository`
