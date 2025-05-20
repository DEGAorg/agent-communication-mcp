import { groth16 } from 'snarkjs';
import * as fs from 'fs';
import { buildPoseidon } from 'circomlibjs';

// Helper function to hash 32 elements exactly as in the circuit
async function hash32Array(poseidon: any, arr: string[]): Promise<string> {
    // Break into 3 chunks: 11 + 11 + 10 as in the circuit
    const chunk1 = arr.slice(0, 11);
    const chunk2 = arr.slice(11, 22);
    const chunk3 = arr.slice(22, 32);

    // Convert each element to BigInt individually and create arrays
    const chunk1BigInt = chunk1.map(x => BigInt(x));
    const chunk2BigInt = chunk2.map(x => BigInt(x));
    const chunk3BigInt = chunk3.map(x => BigInt(x));

    // Hash each chunk and convert to raw BigInt
    const hash1 = poseidon.F.toObject(poseidon(chunk1BigInt));
    const hash2 = poseidon.F.toObject(poseidon(chunk2BigInt));
    const hash3 = poseidon.F.toObject(poseidon(chunk3BigInt));

    // Combine the three hashes and convert to raw BigInt
    const finalHash = poseidon.F.toObject(poseidon([hash1, hash2, hash3]));
    return finalHash.toString();
}

async function main() {
    try {
        // Generate a random AES key (32 field elements)
        const aesKey = Array.from({ length: 32 }, () => 
            Math.floor(Math.random() * 1000000).toString()
        );

        // Generate random public keys for B and Auditor (32 field elements each)
        const pubKeyB = Array.from({ length: 32 }, () => 
            Math.floor(Math.random() * 1000000).toString()
        );
        const pubKeyAuditor = Array.from({ length: 32 }, () => 
            Math.floor(Math.random() * 1000000).toString()
        );

        // Initialize Poseidon hash function
        const poseidon = await buildPoseidon();

        // Hash the AES key using the circuit's exact method
        const hashKey = await hash32Array(poseidon, aesKey);

        // Hash the public keys using the circuit's exact method
        const hashPubB = await hash32Array(poseidon, pubKeyB);
        const hashPubAuditor = await hash32Array(poseidon, pubKeyAuditor);

        // Combine hashes to get final encrypted keys
        const encKeyForB = poseidon.F.toObject(poseidon([BigInt(hashKey), BigInt(hashPubB)]));
        const encKeyForAuditor = poseidon.F.toObject(poseidon([BigInt(hashKey), BigInt(hashPubAuditor)]));

        // Input values for the circuit
        const input = {
            pubKeyB: pubKeyB.map(x => x.toString()),
            pubKeyAuditor: pubKeyAuditor.map(x => x.toString()),
            encKeyForB: encKeyForB.toString(),
            encKeyForAuditor: encKeyForAuditor.toString(),
            aesKey: aesKey.map(x => x.toString())
        };

        console.log("Generating proof...");
        const { proof, publicSignals } = await groth16.fullProve(
            input,
            "build/encryption_proof.wasm",
            "zkeys/encryption_proof_final.zkey"
        );

        // Save proof and public signals
        fs.writeFileSync("encryption_proof.json", JSON.stringify(proof, null, 2));
        fs.writeFileSync("encryption_public.json", JSON.stringify(publicSignals, null, 2));

        console.log("Verifying proof...");
        const verificationKey = JSON.parse(
            fs.readFileSync("zkeys/encryption_proof_verification_key.json", "utf8")
        );
        const isValid = await groth16.verify(verificationKey, publicSignals, proof);

        if (isValid) {
            console.log("Proof is valid! ✅");
            console.log("This proves that both encrypted keys were derived from the same AES key");
        } else {
            console.log("Proof is invalid! ❌");
        }

    } catch (error) {
        console.error("Error:", error);
    }
    process.exit(0);
}

main(); 