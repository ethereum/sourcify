#!/bin/sh

name=$(ipfs add -Q -r /tmp/repository)
echo $name
ipfs name publish --key=sourceRepository $name
