#!/bin/bash

gpg --yes --batch --passphrase=$SECRET_KEY ./environments/.env.secrets.gpg
gpg --yes --batch --passphrase=$SECRET_KEY ./services/ipfs/ipfs-stable.key.gpg
gpg --yes --batch --passphrase=$SECRET_KEY ./services/ipfs/ipfs-latest.key.gpg
