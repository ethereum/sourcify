rm .env
rm ui/.env
mkdir repository
cp .env.${STAGE} .env
cp .env.${STAGE} ui/.env

rm docker-compose.yaml
cp docker-compose-${STAGE}.yaml docker-compose.yaml

docker-compose up --build -d
