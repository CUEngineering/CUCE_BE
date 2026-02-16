#!/bin/sh
set -e;

INSTALLED_FILE_PATH="/home/bun/installed"

if [ ! -f "$INSTALLED_FILE_PATH" ]; then
    echo "Extract built archive"
    tar -xvzf built.tar.gz -C /home/bun/ > /dev/null 2>&1

    echo "Update alpine packages"
    # grep -qxF "http://dl-cdn.alpinelinux.org/alpine/edge/testing" /etc/apk/repositories || echo "http://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories; # add edge testing repositories only if it doesnt exists
    # grep -qxF "http://dl-cdn.alpinelinux.org/alpine/edge/community" /etc/apk/repositories || echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories; # add edge community repositories only if it doesnt exists
    # grep -qxF "http://dl-cdn.alpinelinux.org/alpine/edge/main" /etc/apk/repositories || echo "http://dl-cdn.alpinelinux.org/alpine/edge/main" >> /etc/apk/repositories; # add edge main repositories only if it doesnt exists
    apk update --no-cache && apk upgrade --no-cache;

    # echo "Install curl, g++ and chromium"
    # apk add curl g++ chromium --no-cache;

    # echo "Add Link to ld linux for compatibility with alpine and for uwebsocket.js to work"
    # ln -s /lib/libc.musl-x86_64.so.1 /lib/ld-linux-x86-64.so.2 || true;

    echo "Install curl, git, rsync and bash"
    apk add --no-cache --update curl git rsync bash;

    echo "Install dependencies"
    bun install --frozen-lockfile

    echo "Running db migration"
    if ! bun run --bun run:db:migration; then
        echo "Database migration failed. Exiting."
        exit 1
    fi

    touch "$INSTALLED_FILE_PATH";
fi

echo "Starting Api Service"
bun --bun ./src/main.ts

