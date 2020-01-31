FROM node:10-alpine as builder

ARG WORKSPACE_DIR=/app
WORKDIR ${WORKSPACE_DIR}

COPY . ${WORKSPACE_DIR}
RUN npm ci
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
