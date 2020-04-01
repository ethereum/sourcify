mkdir -p $REPO_PATH
cd $REPO_PATH

if [[ ! -d source-verify ]]; then
    echo $PWD
    git clone https://github.com/ethereum/source-verify.git
    cd source-verify
    git checkout ${CIRCLE_BRANCH}
else
    echo $PWD
    cd source-verify
    git reset --hard origin/${CIRCLE_BRANCH}
fi

echo $PWD && ls -al && TAG=$TAG ACCESS_KEY=$ACCESS_KEY SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY ./scripts/find_replace.sh
cd environments
source .env
DATABASE_PATH=$DATABASE_PATH REPOSITORY_PATH=$REPOSITORY_PATH ../scripts/prepare.sh 
eval ${COMPOSE_COMMAND} pull
eval ${COMPOSE_COMMAND} up -d
../scripts/clear-repo.sh
