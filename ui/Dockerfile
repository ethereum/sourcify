FROM node:10-alpine as builder

ARG WORKSPACE_DIR=/app
WORKDIR ${WORKSPACE_DIR}
COPY . ${WORKSPACE_DIR}
RUN npm ci

EXPOSE 1234

CMD ["npm", "run", "start"]
