# Agent Communication MCP Server

A Model Context Protocol (MCP) server implementation that enables secure, agent-to-agent communication for AI networks using Supabase for real-time messaging. The system provides encrypted message exchange, service discovery, and privacy-preserving data delivery with support for Midnight blockchain integration.

This project implements a hybrid encryption scheme combining AES-256-GCM and X25519 key exchange, with zero-knowledge proof capabilities for selective data disclosure and audit trails.

## Prerequisites
- Node.js 22.15.0 LTS or later
- Yarn 4.1.0
- Supabase account and project

## Quick Start

⚠️ **Before using the MCP, the agent must call `/status` and complete authentication.**

The agent must authenticate via the login endpoint before accessing any marketplace functionality (listing services, payments, messaging, etc.).

## Setup

1. Install dependencies:
```bash
yarn install
```

2. Configure environment:
```bash
cp doc/env.example .env
```
Edit `.env` with your Supabase credentials and agent configuration.

3. Configure Encryption Keys
```bash
yarn keys:generate
```

## Local Development

### STDIO Server
This command is for testing TypeScript compilation only. The STDIO server is automatically started by ElizaOS and should not be run manually.
```bash
yarn dev:stdio
```

### Testing
```bash
yarn test
```

## Production Deployment

### Build and Start
This command builds the production distribution. The server process is automatically managed by ElizaOS and should not be started manually.
```bash
yarn build
```

## Directory Structure

```
├── doc/           # System documentation and diagrams
├── src/           # Source code
├── test/          # Test suite
├── scripts/       # Build and setup scripts
├── supabase/      # Database migrations
└── storage/       # Local storage
```

## Documentation

- **[System Architecture](doc/system-design.md)** - Detailed system overview, MCP tools, and features
- **[Message Format](doc/message.md)** - Message structure and format specifications
- **[Cryptography](doc/cryptography.md)** - Security and encryption implementation
- **[Database Schema](doc/database/README.md)** - Database setup and schema documentation

## Testing

Comprehensive test suite covering all major components. See **[Test Documentation](test/README.md)** for detailed testing information, patterns, and troubleshooting.

## Deployment

*Deployment documentation coming soon. See [doc/system-design.md](doc/system-design.md) for system architecture details.*

## License

MIT 