declare module 'snarkjs' {
    export namespace groth16 {
        interface Proof {
            pi_a: [string, string, string];
            pi_b: [[string, string], [string, string], [string, string]];
            pi_c: [string, string, string];
            protocol: string;
            curve: string;
        }

        interface PublicSignals {
            [key: string]: string;
        }

        function fullProve(
            input: any,
            wasmFile: string,
            zkeyFile: string
        ): Promise<{
            proof: Proof;
            publicSignals: PublicSignals;
        }>;

        function verify(
            verificationKey: any,
            publicSignals: PublicSignals,
            proof: Proof
        ): Promise<boolean>;
    }
} 