#!/bin/bash

echo $SECRET_KEY > secret.key
git-crypt unlock secret.key
rm -rf secret.key
