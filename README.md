# Agent Communication MCP Server

A Model Context Protocol (MCP) server implementation that enables communication between AI agents using Supabase for real-time messaging.

## Prerequisites

- Node.js 18 or later
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
```

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