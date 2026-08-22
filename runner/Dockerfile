# ==============================================================================
# DEVNIX Multi-Language Universal Native Runner Container
# Compiles & executes natively across ARM64, AMD64, x86_64 with ZERO emulation
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
    coreutils

WORKDIR /tmp/sandbox

CMD ["tail", "-f", "/dev/null"]
