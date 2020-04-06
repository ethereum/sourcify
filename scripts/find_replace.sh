#!/bin/bash
set -e

echo $TAG
echo $ACCESS_KEY
echo $SECRET_ACCESS_KEY

search="AWS_ACCESS_KEY_ID=xxx"
replace="AWS_ACCESS_KEY_ID=$ACCESS_KEY"
sed -i "s/${search}/${replace}/g" environments/.env.$TAG

search="AWS_SECRET_ACCESS_KEY=xxx"
replace="AWS_SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY"
sed -i "s/${search}/${replace}/g" environments/.env.$TAG

cp environments/.env.$TAG environments/.env
