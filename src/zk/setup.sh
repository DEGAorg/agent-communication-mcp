#!/bin/bash

set -e  # Exit on error

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to handle errors
handle_error() {
    echo "❌ Error: $1"
    exit 1
}

# Ensure dependencies are installed
if ! command_exists circom; then
    echo "Installing circom..."
    curl -Ls https://github.com/iden3/circom/releases/download/v2.1.6/circom-linux-amd64 -o /tmp/circom || handle_error "Failed to download circom"
    chmod +x /tmp/circom
    sudo mv /tmp/circom /usr/local/bin/circom || handle_error "Failed to install circom"
fi

if ! command_exists snarkjs; then
    echo "Installing snarkjs..."
    npm install -g snarkjs || handle_error "Failed to install snarkjs"
fi

# Create necessary directories
mkdir -p build
mkdir -p zkeys

# Download pot15_final.ptau if not present
if [ ! -f "pot15_final.ptau" ]; then
    echo "⬇️ Downloading trusted setup ptau file (pot15)..."
    wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau -O pot15_final.ptau || handle_error "Failed to download pot15_final.ptau"
fi

# Compile the circuit
echo "⚙️ Compiling circuit..."
circom encryption_proof.circom --r1cs --wasm --sym -o build -l ../../node_modules || handle_error "Circuit compilation failed"

# Run Groth16 trusted setup
echo "🔐 Running Groth16 setup..."
snarkjs groth16 setup build/encryption_proof.r1cs pot15_final.ptau zkeys/encryption_proof_000.zkey || handle_error "Groth16 setup failed"
snarkjs zkey contribute zkeys/encryption_proof_000.zkey zkeys/encryption_proof_final.zkey --name="Contributor" --entropy="$(head -c 64 /dev/urandom | base64)" -v || handle_error "ZKey contribution failed"

# Export verification key
echo "📝 Exporting verification key..."
snarkjs zkey export verificationkey zkeys/encryption_proof_final.zkey zkeys/encryption_proof_verification_key.json || handle_error "Failed to export verification key"

# Copy WASM for convenience
cp build/encryption_proof_js/encryption_proof.wasm build/encryption_proof.wasm || handle_error "Failed to copy WASM file"

# Done
echo "✅ Production ZK setup complete."
echo "Artifacts:"
echo "  - build/encryption_proof.r1cs"
echo "  - build/encryption_proof.wasm"
echo "  - zkeys/encryption_proof_final.zkey"
echo "  - zkeys/encryption_proof_verification_key.json"
