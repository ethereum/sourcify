# Needs to be run from the project root context
FROM node:16
WORKDIR /home/app

COPY *.json ./
COPY packages ./packages
COPY services/server ./services/server

RUN npm install 
RUN npx lerna run build --scope sourcify-server

# Set default value for ARG
ARG NODE_ENV=production

# Set environment variable
ENV NODE_ENV=${NODE_ENV}

WORKDIR /home/app/services/server

CMD ["npm", "start"]