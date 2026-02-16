FROM oven/bun:1.3.9-alpine AS build-container

# set working directory
WORKDIR /home/bun/app

# Set user to root    
USER root

# Copy all files and set owner to node
COPY --chown=node:node . .

# Package artifact and compress
# RUN (chmod +x ./deployment-config/start.sh) && \
#     (tar --create --gzip --verbose --file built.tar.gz --exclude="./node_modules" --exclude="./dist" --exclude="./.git" --exclude="./cache" --warning=no-file-changed "../app" || true)
RUN (chmod +x ./deployment-config/start.sh) && \
    (tar -czvf built.tar.gz ../app)

FROM oven/bun:1.3.9-alpine AS production-container

# set working directory
WORKDIR /home/bun/app

# Set user to root    
USER root

# Copy built archive and startup script
COPY --from=build-container /home/bun/app/built.tar.gz ./
COPY --from=build-container /home/bun/app/deployment-config/start.sh ./start.sh

# Expose port 80
EXPOSE 80

# start api service
CMD ["./start.sh"]
