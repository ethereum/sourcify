# Needs to be run from the project root context
FROM node:18
WORKDIR /home/app

COPY *.json ./
COPY packages ./packages
COPY services/monitor ./services/monitor

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

WORKDIR /home/app/services/monitor

CMD ["npm", "start"]
