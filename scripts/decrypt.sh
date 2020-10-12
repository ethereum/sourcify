#!/bin/bash

gpg --yes --batch --passphrase=$SECRET_KEY ./environments/.env.secrets.gpg
gpg --yes --batch --passphrase=$SECRET_KEY ./environments/ipfs-stable.key.gpg
gpg --yes --batch --passphrase=$SECRET_KEY ./environments/ipfs-latest.key.gpg
