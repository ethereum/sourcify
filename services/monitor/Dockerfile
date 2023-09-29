# Needs to be run from the project root context.
FROM node:18
WORKDIR /home/app

COPY *.json ./
COPY packages ./packages
COPY services/monitor ./services/monitor

RUN npm install
RUN npx lerna run build --scope sourcify-monitor

ARG NODE_ENV=production
ARG ALCHEMY_API_KEY
ARG INFURA_API_KEY
ARG CF_ACCESS_CLIENT_ID
ARG CF_ACCESS_CLIENT_SECRET

WORKDIR /home/app/services/monitor

CMD ["npm", "start"]
