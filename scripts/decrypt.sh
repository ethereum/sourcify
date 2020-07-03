#!/bin/bash

gpg --yes --batch --passphrase=$SECRET_KEY .env.secrets.gpg
