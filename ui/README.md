# Sourcify UI

Bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Running

### Environment variables

Set the environment variables in `.env.development` depending on your settings.

The variables `REACT_APP...` will get injected into the build and are available at runtime.

## Run

Install with `npm install` and run the development server with `npm start`.

## Build

Before build you need to provide the environment variables in `.env.production` or `.env`. Check out [CRA docs on env vars](https://create-react-app.dev/docs/adding-custom-environment-variables/).

Build with

```
npm run build
```

Resulting static assets will be stored at `build/` and ready to be served.

## Docker

The `Dockerfile` installs,builds and serves the project on a minimal nginx container.

Again, don't forget to provide the environment variables in `.env.production` or `.env` ([CRA docs on env vars](https://create-react-app.dev/docs/adding-custom-environment-variables/)).

Build with

```
docker build -t sourcify-ui .
```

Run with

```
docker run -p 80:80 sourcify-ui
```

We also provide a `docker-compose.yml` file for convenience. You can provide the `UI_EXTERNAL_PORT` variable to set the port on your host machine.

```
UI_EXTERNAL_PORT=3000 docker-compose up
```
