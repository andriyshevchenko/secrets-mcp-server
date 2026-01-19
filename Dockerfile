# Use Node.js LTS as base image
FROM node:20-slim

# Install system dependencies for @napi-rs/keyring on Linux
RUN apt-get update && apt-get install -y \
    libsecret-1-0 \
    libsecret-1-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built files
COPY build ./build

# Set environment
ENV NODE_ENV=production

# Run the server
CMD ["node", "build/index.js"]
