# Run from ui/ folder
FROM node:22.5.1-alpine AS builder
RUN mkdir -p /home/app

WORKDIR /home/app
COPY . ./

LABEL org.opencontainers.image.source https://github.com/ethereum/sourcify
LABEL org.opencontainers.image.licenses MIT

RUN npm install
RUN npm run build

FROM nginx:1.27.1-alpine
COPY --from=builder /home/app/build /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf