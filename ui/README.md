# Sourcify new UI

Bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Environment variables

Set the environment variables in `.env.development` depending on your settings. `.env.production` contains the values to be passed during build time.

## Run

Install with `npm install` and run the development server with `npm start`.

## Build

Build with

```
npm run build
```

Resulting static assets will be stored at `build/` and ready to be served.

## Docker

The `Dockerfile` installs,builds and serves the project on a minimal nginx container. When running with Docker, don't forget to pass the environment variables `SERVER_URL` and `REPOSITORY_SERVER_URL`.
