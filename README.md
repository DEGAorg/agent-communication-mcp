# Agent Communication MCP Server

A Model Context Protocol (MCP) server implementation that enables secure, agent-to-agent communication for AI networks using Supabase for real-time messaging. The system provides encrypted message exchange, service discovery, and privacy-preserving data delivery.

## Documentation

- [System Overview](doc/documentation.md) - Detailed system architecture and features
- [Message Format](doc/message.md) - Message structure and format specifications
- [Cryptography](doc/cryptography.md) - Security and encryption details
- [Entity Relations](doc/entity_relation.mmd) - Database schema and relationships
- [Component Diagram](doc/components.mmd) - System component interactions
- [Message Sequence](doc/message_sequence.mmd) - Message flow diagrams

## Prerequisites

- Node.js 22 LTS or later
- Yarn 4.1.0
- Supabase account and project

## Setup

1. Install dependencies:
```bash
yarn install
```

2. Create a `.env` file in the project root with your Supabase credentials:
```bash
cp doc/env.example .env
```

Then edit the `.env` file with your credentials:
```env
MCP_AUTH_EMAIL=your.email@example.com
```

## Key Management

The system uses X25519 key pairs for secure communication. Each agent needs its own key pair.

### Setup Agent

Set up a new agent with encryption keys:
```bash
yarn setup:agent -a <agent-id> [-d <directory>]
```

This will:
- Create the necessary directory structure
- Generate a new X25519 key pair
- Save the keys in the encryption directory
- Set appropriate file permissions

Example:
```bash
yarn setup:agent -a midnight-agent -d /home/cerrato/mnai/midnight-agent
```

The keys will be saved as:
- `<directory>/.storage/encryption/<agent-id>/public.key`
- `<directory>/.storage/encryption/<agent-id>/private.key`

### Generate Key Pair

Generate a new X25519 key pair:
```bash
yarn keys:generate
```

This will:
- Generate a new X25519 key pair
- Display the public and private keys
- Provide instructions for adding them to your `.env` file

Add the generated keys to your `.env` file:
```env
AGENT_PUBLIC_KEY=your_public_key
AGENT_PRIVATE_KEY=your_private_key
```

⚠️ **Security Warning**:
- Keep your private key secure and never share it
- Never commit keys to version control
- Keep a secure backup of your keys
- Store keys in environment variables or secure key management system

## Authentication

The MCP server uses Supabase's magic link authentication. Sessions are stored locally in the `session` directory.

### Setup Authentication

1. Set up your authentication:
```bash
yarn auth:setup
```
This will:
- Prompt for your email
- Send a magic link to your email
- Wait for you to click the link
- Save the session for future use

2. Check authentication status:
```bash
yarn auth:check
```

3. If authentication fails, retry:
```bash
yarn auth:retry
```

### Environment Variables

- `MCP_AUTH_EMAIL`: Your email for authentication
- `MCP_AUTH_POLL_INTERVAL`: Polling interval in milliseconds (default: 2000)
- `MCP_AUTH_MAX_POLL_ATTEMPTS`: Maximum polling attempts (default: 30)

## Development

- Start the development server:
```bash
yarn dev
```

- Start the stdio server:
```bash
yarn dev:stdio
```

## Testing

- Run all tests:
```bash
yarn test
```

- Run tests in watch mode:
```bash
yarn test:watch
```

- Generate test coverage:
```bash
yarn test:coverage
```

## Building

Build the project:
```bash
yarn build
```

## License

MIT 