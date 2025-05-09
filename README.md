# Agent Communication MCP Server

A Model Context Protocol (MCP) server implementation that enables communication between AI agents using Supabase for real-time messaging.

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
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
MCP_AUTH_EMAIL=your.email@example.com
MCP_AUTH_POLL_INTERVAL=2000
MCP_AUTH_MAX_POLL_ATTEMPTS=30
```

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