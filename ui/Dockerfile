FROM node:10 as builder

ARG WORKSPACE_DIR=/app
WORKDIR ${WORKSPACE_DIR}
COPY . ${WORKSPACE_DIR}
RUN npm ci

EXPOSE 3000

CMD ["npm", "run", "start"]
