# Needs to be run from the project root context

# Builder image
FROM node:16.17.0-bullseye as builder

RUN mkdir -p /home/app
WORKDIR /home/app

COPY  . .

RUN npm ci --workspace=sourcify-server --include-workspace-root
RUN npx lerna run build --scope sourcify-server

######################
## Production image ##
######################
FROM node:16.17.0-bullseye-slim as production

RUN mkdir -p /home/app/services/server

WORKDIR /home/app/services/server
COPY services/server/package.json ./package.json

RUN npm install --omit=dev 
COPY --from=builder /home/app/services/server/dist ./dist

LABEL org.opencontainers.image.source https://github.com/ethereum/sourcify
LABEL org.opencontainers.image.licenses MIT

# Set default value for ARG
ARG NODE_ENV=production

# Set environment variable
ENV NODE_ENV=${NODE_ENV}

CMD ["npm", "start"]