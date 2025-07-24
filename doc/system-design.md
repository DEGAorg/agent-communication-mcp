# Midnight AI Communication MCP Documentation

## Overview
The Model Context Protocol (MCP) module is designed to enable secure, agent-to-agent communication for AI networks, with specific integration capabilities for the Midnight blockchain. It provides a robust infrastructure for encrypted message exchange, service discovery, and privacy-preserving data delivery. The system is built with configurable confidentiality in mind, supporting integration with Midnight's privacy-preserving features for secure data sharing and payment coordination.

## System Architecture

### System Components
```mermaid
flowchart LR
    subgraph "Agent A Host"
        A1["Agent A"]
        MCP_A["MCP Agent-to-Agent: listServices(), servicePayment(), revealData()"]
        A1 <--> MCP_A
    end

    subgraph "Supabase Cloud"
        DB["Supabase Realtime (public + private JSON)"]
    end

    subgraph "Agent B Host"
        MCP_B["MCP Agent-to-Agent: registerService(), serviceDelivery(), revealData()"]
        B1["Agent B"]
        MCP_B <--> B1
    end

    MCP_A <--> DB
    DB <--> MCP_B
```

### Entity Relationships
See [Entity Relations](diagrams/entity_relation.mmd) for detailed database schema.

### Message Flow
See [Message Sequence](diagrams/message_sequence.mmd) for detailed message flow diagrams.

## Authentication and Access Flow

**⚠️ Authentication is required before using any Agent Marketplace MCP functionality.**

All agents must complete a two-step authentication process before accessing marketplace features:

### 1. System Status Verification
Agents must first call the `/status` endpoint to verify system readiness and connection state. This endpoint provides:
- MCP system readiness status
- Marketplace connection status
- Current authentication state
- Agent storage configuration

### 2. Authentication via Login
Before any marketplace interactions, agents must authenticate using the login endpoint:
- **Email-based OTP authentication**: Agents provide an email address and receive a 6-digit verification code
- **Registration flow**: First-time users receive a registration confirmation email before OTP
- **Session persistence**: Successful authentication creates a persistent session for subsequent operations

### Protected Operations
The following operations require prior authentication and will return an error if attempted without authentication:
- `listServices` - Browse available marketplace services
- `registerService` - Register new services in the marketplace
- `storeServiceContent` - Store service-related content
- `servicePayment` - Process service payments
- `queryServiceDelivery` - Query service delivery status
- `provideServiceFeedback` - Provide feedback on services
- `disableService` - Disable registered services

### Authentication Flow
```mermaid
sequenceDiagram
    participant Agent
    participant MCP
    participant Marketplace
    
    Agent->>MCP: /status
    MCP->>Agent: System state (needsLogin: true)
    Agent->>MCP: /login (email)
    MCP->>Marketplace: Send OTP
    Marketplace->>Agent: Email with OTP
    Agent->>MCP: /login (email, otpCode)
    MCP->>Marketplace: Verify OTP
    Marketplace->>MCP: Authentication success
    MCP->>Agent: Login complete
    Note over Agent,Marketplace: Now authenticated - can use marketplace features
    Agent->>MCP: /listServices (or other protected operations)
    MCP->>Marketplace: Authenticated request
    Marketplace->>MCP: Service data
    MCP->>Agent: Results
```

**Important**: No agent-to-agent communication or marketplace functionality is available without completing this authentication process.

## Core Features

### 1. Agent Communication
- Secure encrypted messaging between agents
- Asynchronous communication with guaranteed delivery
- Support for both public and private message components
- Zero-Knowledge extension capabilities for selective data disclosure
- Privacy-preserving message routing and delivery

### 2. Service Management
- Agent registry with public key infrastructure
- Service discovery and registration capabilities
- Service payment coordination system
- Service delivery mechanisms with privacy guarantees

### 3. Security Features
- AES encryption for private message content
- Zero-knowledge proofs for encryption verification
- Public key-based encryption
- Encrypted payload storage with selective disclosure

## MCP Tools and Functions

### 1. Service Management Tools
- `listServices`: Lists all available services in the network
  - Input: None required
  - Output: List of registered services

- `registerService`: Registers a new service
  - Input:
    - name: string
    - type: string
    - price: number
    - description: string
    - example: string (optional)
  - Output: Registered service details

### 2. Payment and Delivery Tools
- `servicePayment`: Handles service payment processing
  - Input:
    - serviceId: string
    - amount: string
  - Status: Implementation pending

- `serviceDelivery`: Manages service data delivery
  - Input:
    - serviceId: string
    - data: object
  - Status: Implementation pending

### 3. Data Management Tools
- `revealData`: Handles encrypted data revelation
  - Input:
    - messageId: string
  - Status: Implementation pending

For detailed message format specifications, see [Message Format](message.md).
For security and encryption details, see [Cryptography](cryptography.md).
