# ==============================================================================
# DEVNIX Multi-Language Universal Native Runner Container
# Compiles & executes natively across ARM64, AMD64, x86_64 with ZERO emulation
# User code runs as an unprivileged user via the runner agent (no Docker socket)
# ==============================================================================
FROM alpine:3.20

RUN apk add --no-cache \
    gcc \
    g++ \
    musl-dev \
    libc-dev \
    openjdk21-jre \
    openjdk21 \
    rust \
    cargo \
    go \
    python3 \
    nodejs \
    ruby \
    php \
    bash \
    coreutils \
    procps

RUN adduser -D -H -u 10001 sandbox
COPY agent.js /opt/devnix/agent.js

ENV HOME=/tmp
USER 10001
WORKDIR /tmp
EXPOSE 7070

CMD ["node", "/opt/devnix/agent.js"]
