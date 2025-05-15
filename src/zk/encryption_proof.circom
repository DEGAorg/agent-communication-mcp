pragma circom 2.1.6;

include "circomlib/circuits/sha256/sha256.circom";

template EncryptionProof() {
    // Public inputs
    signal input messageHash[32];

    // Private inputs
    signal input plaintext[32];

    // Intermediate
    signal computedHash[32];

    component sha256Hasher = SHA256();

    for (var i = 0; i < 32; i++) {
        sha256Hasher.input[i] <== plaintext[i];
    }

    for (var i = 0; i < 32; i++) {
        computedHash[i] <== sha256Hasher.output[i];
        computedHash[i] === messageHash[i];
    }
}

component main = EncryptionProof(); 