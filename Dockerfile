FROM node:24.2.0-alpine3.22 AS build-container

# set working directory
WORKDIR /app

# Set user to root    
USER root

# Update packages
RUN apk add --update --no-cache tar && \
    npm install --force --global npm bun;

# Copy all files and set owner to node
COPY --chown=node:node . .

# Install dependencies and build
RUN bun install --ignore-scripts && \
    bunx prisma generate && \
    npm run build && \
    (chmod +x ./deployment-config/start.sh) && \
    (tar -czvf built.tar.gz dist prisma supabase templates package.json bun.lock .env)

FROM oven/bun:1.3.9-alpine AS production-container

# set working directory
WORKDIR /home/bun/app

# Set user to root    
USER root

RUN apk update --no-cache && apk upgrade --no-cache && \ 
    apk add --update --no-cache curl tar git rsync bash

# Copy built archive and startup script
COPY --from=build-container /app/built.tar.gz ./
COPY --from=build-container /app/deployment-config/start.sh ./start.sh

# Expose port 80
EXPOSE 80

# start api service
CMD ["./start.sh"]
