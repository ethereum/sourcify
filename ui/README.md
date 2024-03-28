# Sourcify UI

Bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Running

### Environment variables

Set the environment variables in `.env.development` depending on your settings.

The variables `REACT_APP...` will get injected into the build and are available at runtime.

### Run

Install with `npm install` and run the development server with `npm start`.

## Build

Before build you need to provide the environment variables in `.env.production` or `.env`. Check out [CRA docs on env vars](https://create-react-app.dev/docs/adding-custom-environment-variables/).

Build with

```
npm run build
```

Resulting static assets will be stored at `build/` and ready to be served.

## Building with Docker

The `Dockerfile` installs, builds and serves the project on a minimal nginx container.

Again, don't forget to provide the environment variables in `.env.production` or `.env` ([CRA docs on env vars](https://create-react-app.dev/docs/adding-custom-environment-variables/)).

Build with

```
docker build -t sourcify-ui .
```

Run with

```
docker run -p 80:80 sourcify-ui
```

## Running with the published Docker image

The Docker image is published on [Github Container Registry](https://github.com/ethereum/sourcify/pkgs/container/sourcify%2Fui). You can run it with

```
docker run -p 80:80 ghcr.io/ethereum/sourcify/ui:latest
```

However pleases note that the values in the `.env` files are injected on the build time so you won't be able to provide custom values for the environment variables:

```bash
REACT_APP_SERVER_URL=https://sourcify.dev/server
REACT_APP_REPOSITORY_SERVER_URL=https://repo.sourcify.dev
# Use DNSLink for IPNS
REACT_APP_IPNS=repo.sourcify.dev
REACT_APP_TAG=master
```

If you want to provide custom values for the environment variables you need to build the image yourself.

A workaround could be running a custom find and replace on the files before running the image:

```bash
find /usr/share/nginx/html/ -type f -exec sed -i 's#docs.sourcify.dev#yourcustomlink.com#g' {} \;;
```
