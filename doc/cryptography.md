### 🔹 Symmetric Encryption (AES-256-GCM)

- Use AES-256-GCM for message encryption
- Generate a random 32-byte key for each message
- Use a random 12-byte nonce for each encryption
- Message format: `nonce + ciphertext + tag`

### 🔹 Key Exchange (X25519)

- Use X25519 (Curve25519) for key exchange
- Each agent generates an X25519 key pair
- Public keys are stored in the `AGENT` table
- Private keys are stored securely by each agent
- Used to encrypt the AES key for each recipient

### 🔹 Hybrid Encryption Flow

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