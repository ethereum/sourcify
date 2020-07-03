#!/bin/bash

gpg --yes --batch --passphrase=$SECRET_KEY ./environments/.env.secrets.gpg
