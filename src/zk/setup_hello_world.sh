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

# Generate new Powers of Tau file
if [ ! -f "pot10_final.ptau" ]; then
    echo "Generating new Powers of Tau file..."
    # Create entropy file
    echo "test entropy for development" > entropy.txt
    
    # Generate initial ptau file
    snarkjs powersoftau new bn128 10 pot10_0000.ptau -v || handle_error "Failed to generate initial Powers of Tau file"
    
    # Contribute using entropy file
    snarkjs powersoftau contribute pot10_0000.ptau pot10_0001.ptau --name="First contribution" -v -e="$(cat entropy.txt)" || handle_error "Failed to contribute to Powers of Tau"
    
    # Prepare phase 2
    snarkjs powersoftau prepare phase2 pot10_0001.ptau pot10_final.ptau -v || handle_error "Failed to prepare phase 2"
    
    # Cleanup
    rm pot10_0000.ptau pot10_0001.ptau entropy.txt
fi

# Verify the Powers of Tau file
if [ ! -s "pot10_final.ptau" ]; then
    handle_error "Powers of Tau file is empty"
fi

# Verify the file format
echo "Verifying Powers of Tau file..."
snarkjs powersoftau verify pot10_final.ptau || handle_error "Powers of Tau file verification failed"

# Compile the circuit
echo "Compiling Hello World circuit..."
circom hello_world.circom --r1cs --wasm --sym -o build || handle_error "Circuit compilation failed"

# Generate the zkey
echo "Starting trusted setup..."
snarkjs groth16 setup build/hello_world.r1cs pot10_final.ptau zkeys/hello_world_final.zkey || handle_error "Trusted setup failed"

# Export verification key
echo "Exporting verification key..."
snarkjs zkey export verificationkey zkeys/hello_world_final.zkey zkeys/hello_world_verification_key.json || handle_error "Failed to export verification key"

# Copy wasm file to build directory
cp build/hello_world_js/hello_world.wasm build/hello_world.wasm || handle_error "Failed to copy WASM file"

echo "Setup complete! Files generated:"
echo "- build/hello_world.wasm"
echo "- zkeys/hello_world_final.zkey"
echo "- zkeys/hello_world_verification_key.json" 