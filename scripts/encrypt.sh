#!/bin/bash

gpg --yes --batch --passphrase=$SECRET_KEY -c .env.secrets
