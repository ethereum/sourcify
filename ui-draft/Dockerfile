FROM node:14-alpine as builder

# RUN apk update && apk upgrade && \
#     apk add --no-cache curl

ARG WORKSPACE_DIR=/app
WORKDIR ${WORKSPACE_DIR}
COPY . ${WORKSPACE_DIR}
RUN npm ci

EXPOSE 1234

CMD ["npm", "run", "start"]
