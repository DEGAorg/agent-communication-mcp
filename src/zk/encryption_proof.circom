pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";

template Hash32Array() {
    signal input in[32];
    signal output out;

    // Break into 3 chunks: 11 + 11 + 10
    component p1 = Poseidon(11);
    component p2 = Poseidon(11);
    component p3 = Poseidon(10);
    component pFinal = Poseidon(3);

    for (var i = 0; i < 11; i++) {
        p1.inputs[i] <== in[i];
        p2.inputs[i] <== in[11 + i];
    }

    for (var i = 0; i < 10; i++) {
        p3.inputs[i] <== in[22 + i];
    }

    pFinal.inputs[0] <== p1.out;
    pFinal.inputs[1] <== p2.out;
    pFinal.inputs[2] <== p3.out;

    out <== pFinal.out;
}

template SameKeyProof() {
    // Inputs
    signal input aesKey[32];
    signal input pubKeyB[32];
    signal input pubKeyAuditor[32];
    signal input encKeyForB;
    signal input encKeyForAuditor;

    // Hash aesKey once
    component hashKey = Hash32Array();
    for (var i = 0; i < 32; i++) {
        hashKey.in[i] <== aesKey[i];
    }

    // Hash public keys
    component hashPubB = Hash32Array();
    component hashPubAuditor = Hash32Array();

    for (var i = 0; i < 32; i++) {
        hashPubB.in[i] <== pubKeyB[i];
        hashPubAuditor.in[i] <== pubKeyAuditor[i];
    }

    // Combine AES + pub key hashes
    component outB = Poseidon(2);
    component outA = Poseidon(2);

    outB.inputs[0] <== hashKey.out;
    outB.inputs[1] <== hashPubB.out;

    outA.inputs[0] <== hashKey.out;
    outA.inputs[1] <== hashPubAuditor.out;

    // Enforce outputs match public commitments
    encKeyForB === outB.out;
    encKeyForAuditor === outA.out;
}

component main = SameKeyProof();
