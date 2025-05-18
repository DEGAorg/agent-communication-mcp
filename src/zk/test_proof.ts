import { groth16 } from 'snarkjs';
import * as fs from 'fs';

async function main() {
    try {
        // Input values
        const input = {
            publicNumber: "10",
            privateNumber: "5"
        };

        console.log("Generating proof...");
        const { proof, publicSignals } = await groth16.fullProve(
            input,
            "build/hello_world.wasm",
            "zkeys/hello_world_final.zkey"
        );

        // Save proof and public signals
        fs.writeFileSync("proof.json", JSON.stringify(proof, null, 2));
        fs.writeFileSync("public.json", JSON.stringify(publicSignals, null, 2));

        console.log("Verifying proof...");
        const verificationKey = JSON.parse(fs.readFileSync("zkeys/hello_world_verification_key.json", "utf8"));
        const isValid = await groth16.verify(verificationKey, publicSignals, proof);

        if (isValid) {
            console.log("Proof is valid! ✅");
        } else {
            console.log("Proof is invalid! ❌");
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

main(); 