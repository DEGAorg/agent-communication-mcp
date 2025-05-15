#!/bin/bash

set -e  # Exit on error

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to handle errors
handle_error() {
    echo "Error: $1"
    exit 1
}

# Install dependencies if not already installed
if ! command_exists circom; then
    echo "Installing circom..."
    # Install circom using the official method
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

# Download smaller Powers of Tau file for testing
if [ ! -f "pot10_final.ptau" ]; then
    echo "Downloading Powers of Tau file (size 10)..."
    # Try multiple sources for the Powers of Tau file
    if ! curl -L https://ipfs.io/ipfs/QmNf1UsmdGaMbpatQ6toXSkzXpRYzfrb4F6tXm6N9txnYd -o pot10_final.ptau; then
        if ! curl -L https://storage.googleapis.com/powersoftau/powersOfTau28_hez_final_10.ptau -o pot10_final.ptau; then
            if ! curl -L https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau -o pot10_final.ptau; then
                handle_error "Failed to download Powers of Tau file from all sources"
            fi
        fi
    fi
fi

# Verify the Powers of Tau file
if [ ! -s "pot10_final.ptau" ]; then
    handle_error "Powers of Tau file is empty"
fi

# Check file size (should be around 20MB)
FILE_SIZE=$(stat -f%z pot10_final.ptau 2>/dev/null || stat -c%s pot10_final.ptau 2>/dev/null)
MIN_SIZE=$((10*1024*1024))  # 10MB in bytes
if [ "$FILE_SIZE" -lt "$MIN_SIZE" ]; then
    echo "Warning: Powers of Tau file seems too small (${FILE_SIZE} bytes). Downloading again..."
    rm pot10_final.ptau
    # Try downloading from IPFS as a last resort
    curl -L https://ipfs.io/ipfs/QmNf1UsmdGaMbpatQ6toXSkzXpRYzfrb4F6tXm6N9txnYd -o pot10_final.ptau || handle_error "Failed to download Powers of Tau file"
fi

# Compile the circuit
echo "Compiling circuit..."
circom encryption_proof.circom --r1cs --wasm --sym -o build || handle_error "Circuit compilation failed"

# Generate the zkey
echo "Starting trusted setup..."
snarkjs groth16 setup build/encryption_proof.r1cs pot10_final.ptau zkeys/encryption_proof_final.zkey || handle_error "Trusted setup failed"

# Export verification key
echo "Exporting verification key..."
snarkjs zkey export verificationkey zkeys/encryption_proof_final.zkey zkeys/verification_key.json || handle_error "Failed to export verification key"

# Copy wasm file to build directory
cp build/encryption_proof_js/encryption_proof.wasm build/encryption_proof.wasm || handle_error "Failed to copy WASM file"

echo "Setup complete! Files generated:"
echo "- build/encryption_proof.wasm"
echo "- zkeys/encryption_proof_final.zkey"
echo "- zkeys/verification_key.json" 