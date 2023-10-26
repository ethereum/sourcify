# sourcify-server

Sourcify's server for verifying contracts.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v16)

### Environment Variables

Copy the `.env.dev` file into a file named `.env` and fill in the values.

### Running

```bash
npm install
npm start
```

## Docker

We provide a `docker-compose.yml` file for convenience.

To run in a container you can use this compose file and provide these environment variables for your host machine:

```bash
DOCKER_HOST_SERVER_PORT=
DOCKER_HOST_SOLC_REPO=
DOCKER_HOST_SOLJSON_REPO=
DOCKER_HOST_REPOSITORY_PATH=
```

Also update these as these will be different in the container than in your host machine:

```bash
SERVER_PORT=5555
SOLC_REPO=/data/solc-bin/linux-amd64
SOLJSON_REPO=/data/solc-bin/soljson
REPOSITORY_PATH=/data/repository
```

Then run:

```bash
docker-compose up
```
