FROM node:10 as builder

ARG WORKSPACE_DIR=/app
WORKDIR ${WORKSPACE_DIR}

COPY . ${WORKSPACE_DIR}
RUN npm install
CMD ["npm", "start"]

# FROM nginx:alpine

# COPY --from=builder /app/nginx.conf /etc/nginx/conf.d/default.conf
# COPY --from=builder /app/dist /usr/share/nginx/html

# EXPOSE 80

# CMD ["nginx", "-g", "daemon off;"]
