#!/bin/bash

gpg --yes --batch --passphrase=$SECRET_KEY -c ./environments/.env.secrets
gpg --yes --batch --passphrase=$SECRET_KEY -c ./environments/ipfs.key

