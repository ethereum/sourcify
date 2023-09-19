# Needs to be run from the project root context
FROM node:18
WORKDIR /home/app

COPY *.json ./
COPY packages ./packages
COPY services/monitor ./services/monitor

WORKDIR /home/app/services/monitor

RUN npm install && npx lerna run build --scope sourcify-monitor

ARG NODE_ENV=production
ARG ALCHEMY_API_KEY
ARG INFURA_API_KEY
ARG CF_ACCESS_CLIENT_ID
ARG CF_ACCESS_CLIENT_SECRET


CMD ["npm", "start"]
