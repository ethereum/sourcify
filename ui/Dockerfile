FROM node:16-alpine AS builder

# To be injected by create-react-app on build time 
ARG SERVER_URL
ARG REPOSITORY_SERVER_URL
ARG IPNS
ARG TAG

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY --chown=node:node . ./


RUN npm install 
RUN npm run build

FROM nginx:alpine
COPY --from=builder /home/node/app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf