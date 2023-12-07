# Needs to be run from the project root context
FROM node:18.18.2-bullseye-slim
RUN mkdir -p /home/app/sourcify && chown -R node:node /home/app/sourcify
USER node

WORKDIR /home/app/sourcify

LABEL org.opencontainers.image.source https://github.com/ethereum/sourcify
LABEL org.opencontainers.image.licenses MIT

COPY --chown=node:node *.json ./
COPY --chown=node:node packages ./packages
COPY --chown=node:node services/monitor ./services/monitor

RUN npm install
RUN npx lerna run build --scope sourcify-monitor

ARG ALCHEMY_API_KEY
ARG INFURA_API_KEY
ARG CF_ACCESS_CLIENT_ID
ARG CF_ACCESS_CLIENT_SECRET

# Set default value for ARG
ARG NODE_ENV=production

# Set environment variable
ENV NODE_ENV=${NODE_ENV}

WORKDIR /home/app/sourcify/services/monitor

CMD ["npm", "start"]
