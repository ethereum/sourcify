#!/bin/bash
source ../environments/.env # You can also use some other environment

path="./synced"
logPath="."

mkdir $path

aws s3 sync $BUCKET_NAME/repository $path

echo "Mainnet" >> $logPath/sort.log
echo "########################################"  >> $logPath/sort.log
cp -urv $path/contract/byChainId/1/. $path/contract/mainnet/. $path/contract/1/ >> $logPath/sort.log
echo "########################################"  >> $logPath/sort.log
echo "Ropsten"  >> $logPath/sort.log
echo "########################################"  >> $logPath/sort.log
cp -urv $path/contract/byChainId/3/. $path/contract/ropsten/. $path/contract/3/  >> $logPath/sort.log
echo "########################################"  >> $logPath/sort.log
echo "Rinkeby"  >> $logPath/sort.log
echo "########################################"  >> $logPath/sort.log
cp -urv $path/contract/byChainId/4/. $path/contract/rinkeby/. $path/contract/4/  >> $logPath/sort.log
echo "########################################"  >> $logPath/sort.log
echo "Goerli"  >> $logPath/sort.log
echo "########################################"  >> $logPath/sort.log
cp -urv $path/contract/byChainId/5/. $path/contract/goerli/. $path/contract/5/  >> $logPath/sort.log
echo "########################################"  >> $logPath/sort.log
echo "Kovan"  >> $logPath/sort.log
echo "########################################"  >> $logPath/sort.log
cp -urv $path/contract/byChainId/42/. $path/contract/kovan/. $path/contract/42/  >> $logPath/sort.log
echo "########################################"  >> $logPath/sort.log

aws s3 sync $path $BUCKET_NAME/repository
