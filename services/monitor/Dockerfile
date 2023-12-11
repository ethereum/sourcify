# Needs to be run from the project root context
FROM node:18.18.2-bullseye as builder
RUN mkdir -p /home/app/sourcify
WORKDIR /home/app/sourcify

COPY  . .

RUN npm ci --workspace=sourcify-monitor --include-workspace-root
RUN npx lerna run build --scope sourcify-monitor

######################
## Production image ##
######################
FROM node:16.17.0-bullseye-slim as production

RUN mkdir -p /home/app/sourcify/services/monitor

WORKDIR /home/app/sourcify/services/monitor
COPY services/monitor/package.json ./package.json

RUN npm install --omit=dev 
COPY --from=builder /home/app/sourcify/services/monitor/dist ./dist

LABEL org.opencontainers.image.source https://github.com/ethereum/sourcify
LABEL org.opencontainers.image.licenses MIT

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
