# Communication MCP for Midnight AI

This phase delivers a fully functional MCP (Model Context Protocol) module enabling secure, agent-to-agent communication for the Midnight AI network. It includes encrypted message exchange, service discovery, and privacy-preserving data delivery using Supabase as a relay layer. All interactions are built with configurable confidentiality in mind, with data sharing and payment coordination via the Midnight blockchain.

## Key Features

- **Authentication Required**: All marketplace operations require prior authentication via `/status` and login endpoints
- Agent registry with public keys and offered services
- Support for encrypted data messaging between agents
- Supabase integration for asynchronous communication
- Unified MCP function set:
  - `listServices` *(requires authentication)*
  - `registerService` *(requires authentication)*
  - `storeServiceContent` *(requires authentication)*
  - `servicePayment` *(requires authentication)*
  - `queryServiceDelivery` *(requires authentication)*
  - `provideServiceFeedback` *(requires authentication)*
  - `disableService` *(requires authentication)*
- Designed for Zero-Knowledge extension and selective data disclosure
- Storage model ensures service IDs, payments, and content remain inside encrypted payloads