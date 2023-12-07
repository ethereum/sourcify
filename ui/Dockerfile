FROM node:16.17-alpine AS builder
USER node
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY --chown=node:node . ./

LABEL org.opencontainers.image.source https://github.com/ethereum/sourcify
LABEL org.opencontainers.image.licenses MIT

RUN npm install
RUN npm run build

FROM nginx:1.25.3-alpine
COPY --from=builder /home/node/app/build /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf