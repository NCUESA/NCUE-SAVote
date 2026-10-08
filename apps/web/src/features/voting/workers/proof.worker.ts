import * as snarkjs from 'snarkjs';

self.onmessage = async (e: MessageEvent) => {
    const { input, wasmPath, zkeyPath } = e.data;

    try {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
        self.postMessage({ type: 'SUCCESS', proof, publicSignals });
    } catch (error) {
        // 不要把 error 整個丟進 console：snarkjs 的錯誤物件可能帶上 witness 內容，
        // 而 witness 就包含 studentIdHash 與投票用的 secret。
        self.postMessage({
            type: 'ERROR',
            error: (error as Error)?.message || 'PROOF_GENERATION_FAILED',
        });
    }
};
