# Use Node.js 22.15.1 as the base image
FROM node:22.15.1-alpine

# Set working directory
WORKDIR /app

# Install system dependencies needed for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Enable Corepack for Yarn 4.x support
RUN corepack enable

# Copy package files
COPY package.json yarn.lock .yarnrc.yml ./

# # Copy yarn configuration
# COPY .yarn .yarn

# Install dependencies using the correct Yarn version
RUN yarn install --frozen-lockfile

# Copy source code and test files
COPY . .

# Build the project (optional, for completeness)
RUN yarn build

# Set environment variables for testing
ENV NODE_ENV=test
ENV NODE_OPTIONS=--experimental-vm-modules

# Expose port (if needed for any tests)
EXPOSE 3000

# Default command to run tests
CMD ["yarn", "test"]
