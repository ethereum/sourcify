# Needs to be run from the project root context
FROM node:16.17.0-bullseye-slim
RUN mkdir -p /home/app
WORKDIR /home/app

LABEL org.opencontainers.image.source https://github.com/ethereum/sourcify
LABEL org.opencontainers.image.licenses MIT

COPY *.json ./
COPY packages ./packages
COPY services/server ./services/server

RUN npm ci --only=production
RUN npx lerna run build --scope sourcify-server

# Set default value for ARG
ARG NODE_ENV=production

# Set environment variable
ENV NODE_ENV=${NODE_ENV}

WORKDIR /home/app/services/server

USER node
CMD ["npm", "start"]