# Stage 1: Builder
FROM node:20-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    libsecret-1-dev \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript code
RUN npm run build

# Remove devDependencies
RUN npm prune --omit=dev

# Stage 2: Production
FROM node:20-slim

# Build argument for version
ARG VERSION=unknown

# Add OCI labels for image metadata
LABEL org.opencontainers.image.title="secrets-mcp-server"
LABEL org.opencontainers.image.description="Enable your AI to securely and platform-independently store and retrieve Secrets"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.source="https://github.com/andriyshevchenko/secrets-mcp-server"
LABEL org.opencontainers.image.licenses="ISC"

# Install only runtime dependencies
RUN apt-get update && apt-get install -y \
    libsecret-1-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Copy built code and production dependencies from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production

# Run the server
CMD ["node", "build/index.js"]
