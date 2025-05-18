FROM node:18

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    vim \
    less \
    && rm -rf /var/lib/apt/lists/*

# Install circom
RUN curl -Ls https://github.com/iden3/circom/releases/download/v2.1.6/circom-linux-amd64 -o /usr/local/bin/circom \
    && chmod +x /usr/local/bin/circom

# Create working directory
WORKDIR /app

# Copy all files (including package.json, tsconfig.json, types, and sources)
COPY . .

# Install dependencies
RUN npm install

# Make setup script executable
RUN chmod +x setup_hello_world.sh

# Set up a proper shell environment
ENV SHELL=/bin/bash
ENV TERM=xterm-256color

# Default command to keep container running
CMD ["tail", "-f", "/dev/null"] 