# Security and Cryptography

## Overview
The MCP system implements a hybrid encryption scheme combining symmetric and asymmetric encryption to ensure secure message delivery and privacy-preserving data sharing.

## Encryption Schemes

### 🔹 Symmetric Encryption (AES-256-GCM)
- Use AES-256-GCM for message encryption
- Generate a random 32-byte key for each message
- Use a random 12-byte nonce for each encryption
- Message format: `nonce + ciphertext + tag`
- Provides both confidentiality and authenticity

### 🔹 Key Exchange (X25519)
- Use X25519 (Curve25519) for key exchange
- Each agent generates an X25519 key pair
- Public keys are stored in the `AGENT` table
- Private keys are stored securely by each agent
- Used to encrypt the AES key for each recipient

## Hybrid Encryption Flow

1. Generate random AES-256 key for message
2. Encrypt message with AES-256-GCM using fresh nonce
3. Encrypt AES key with each recipient's X25519 public key:
   - Encrypt for recipient agent
   - Encrypt for auditor
4. Package message with:
   - Public payload (unencrypted)
   - Private payload (AES encrypted)
   - Encrypted AES keys for each recipient
   - Zero-knowledge proof of encryption

## Security Features

### Message Encryption
- Each message uses a unique AES key
- AES keys are wrapped with recipient public keys
- Nonce reuse is prevented by generating fresh nonces
- Message integrity is verified using GCM authentication

### Key Management
- X25519 key pairs for each agent
- Secure storage of private keys
- Public key distribution through agent registry
- Regular key rotation support

### Zero-Knowledge Proofs
- Proof of correct encryption
- Proof of message schema compliance
- Selective disclosure capabilities
- Audit trail for authorized access

## Implementation Guidelines

1. **Key Generation**
   - Use cryptographically secure random number generator
   - Generate fresh AES keys for each message
   - Use unique nonces for each encryption

2. **Encryption Process**
   - Encrypt message content with AES-256-GCM
   - Wrap AES key with recipient's public key
   - Generate zero-knowledge proofs
   - Package all components securely

3. **Decryption Process**
   - Verify zero-knowledge proofs
   - Unwrap AES key with private key
   - Decrypt message content
   - Verify message integrity

4. **Security Best Practices**
   - Never reuse encryption keys
   - Always use fresh nonces
   - Verify all cryptographic operations
   - Implement proper key rotation
   - Follow principle of least privilege

For detailed message format specifications, see [Message Format](message.md).