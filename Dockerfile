# Use Node.js LTS as base image
FROM node:20-slim

# Install system dependencies for @napi-rs/keyring on Linux
RUN apt-get update && apt-get install -y \
    libsecret-1-0 \
    libsecret-1-dev \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy all necessary files
COPY package.json tsconfig.json ./
COPY src ./src

# Install dependencies and build
RUN npm install && \
    npm run build && \
    npm prune --omit=dev

# Set environment
ENV NODE_ENV=production

# Run the server
CMD ["node", "build/index.js"]
