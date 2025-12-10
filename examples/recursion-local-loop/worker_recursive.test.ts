// import { Barretenberg, UltraHonkBackend, deflattenFields } from '@aztec/bb.js';
// import { jest } from '@jest/globals';
// import { Noir } from '@noir-lang/noir_js';
// import { existsSync, readFileSync } from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';

// const __dirname = path.dirname(fileURLToPath(import.meta. url));

// const HONK_VK_SIZE = 59;
// const HONK_PROOF_SIZE = 258;

// // Helper to convert bigint to 32-byte Buffer (like Fr. toBuffer())
// function toBuffer32(value: bigint): Buffer {
//     const hex = value.toString(16).padStart(64, '0');
//     return Buffer.from(hex, 'hex');
// }

// function loadJson(relativePath: string) {
//     const absolutePath = path.join(__dirname, relativePath);
//     if (! existsSync(absolutePath)) {
//         throw new Error(`Missing ${relativePath}. Run 'yarn recursion: build' first.`);
//     }
//     return JSON.parse(readFileSync(absolutePath, 'utf8'));
// }

// describe('WorkerTask -> LeaderAggregator recursion', () => {
//     let workerNoir: Noir | undefined;
//     let leaderNoir: Noir | undefined;
//     let workerBackend: UltraHonkBackend | undefined;
//     let leaderBackend: UltraHonkBackend | undefined;

//     beforeAll(async () => {
//         jest.setTimeout(120000);

//         const workerCircuitJson = loadJson('target/worker_task.json');
//         const leaderCircuitJson = loadJson('target/leader_aggregator.json');

//         console.log('Worker bytecode length:', workerCircuitJson.bytecode.length);
//         console.log('Leader bytecode length:', leaderCircuitJson.bytecode. length);

//         workerNoir = new Noir(workerCircuitJson);
//         leaderNoir = new Noir(leaderCircuitJson);

//         workerBackend = new UltraHonkBackend(workerCircuitJson. bytecode, { threads: 8 }, { recursive: true });
//         leaderBackend = new UltraHonkBackend(leaderCircuitJson.bytecode, { threads: 8 }, { recursive: false });
//     });

//     afterAll(async () => {
//         if (workerBackend) await workerBackend.destroy();
//         if (leaderBackend) await leaderBackend. destroy();
//     });

//     it('produces a WorkerTask proof and verifies it recursively in LeaderAggregator', async () => {
//         jest.setTimeout(180000);

//         if (!workerNoir || !leaderNoir || !workerBackend || !leaderBackend) {
//             throw new Error('Test setup did not complete.');
//         }

//         // Create temporary Barretenberg instance for pedersenHash
//         const bb = await Barretenberg.new({ threads: 1 });

//         const secret = 42n;
//         const secretBuffer = toBuffer32(secret);
//         const pedersen = await bb.pedersenHash({ inputs: [secretBuffer], hashIndex: 0 });
//         const hExpected = '0x' + Buffer.from(pedersen.hash).toString('hex');

//         await bb.destroy();

//         const { witness:  workerWitness } = await workerNoir.execute({ 
//             secret: secret. toString(), 
//             h_expected: hExpected 
//         });

//         const workerProofData = await workerBackend.generateProof(workerWitness, { keccakZK: true });
//         const workerVk = await workerBackend.getVerificationKey({ keccakZK: true });

//         const vkFields = deflattenFields(workerVk);
//         const proofFields = deflattenFields(workerProofData.proof);

//         expect(vkFields.length).toBe(HONK_VK_SIZE);
//         expect(proofFields.length).toBe(HONK_PROOF_SIZE);

//         const recursiveInputs = {
//             verification_key: vkFields,
//             proof: proofFields,
//             public_inputs: [hExpected],
//         };

//         const { witness: leaderWitness } = await leaderNoir.execute(recursiveInputs);

//         const leaderProofData = await leaderBackend.generateProof(leaderWitness);
//         const verified = await leaderBackend.verifyProof(leaderProofData);
//         expect(verified).toBe(true);
//     });
// });

import { Barretenberg, UltraHonkBackend, RawBuffer, deflattenFields } from '@aztec/bb.js';
import { jest } from '@jest/globals';
import { Noir } from '@noir-lang/noir_js';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HONK_VK_SIZE = 59;
const HONK_PROOF_SIZE = 258;

function toBuffer32(value: bigint): Buffer {
    const hex = value.toString(16).padStart(64, '0');
    return Buffer.from(hex, 'hex');
}

function loadJson(relativePath: string) {
    const absolutePath = path.join(__dirname, relativePath);
    if (! existsSync(absolutePath)) {
        throw new Error(`Missing ${relativePath}.  Run 'yarn recursion: build' first.`);
    }
    return JSON.parse(readFileSync(absolutePath, 'utf8'));
}

describe('WorkerTask -> LeaderAggregator recursion', () => {
    let workerCircuitJson: any;
    let leaderCircuitJson: any;
    let workerNoir: Noir;
    let leaderNoir: Noir;

    beforeAll(async () => {
        jest.setTimeout(120000);

        workerCircuitJson = loadJson('target/worker_task.json');
        leaderCircuitJson = loadJson('target/leader_aggregator.json');

        console.log('Worker bytecode length:', workerCircuitJson.bytecode.length);
        console.log('Leader bytecode length:', leaderCircuitJson.bytecode.length);

        workerNoir = new Noir(workerCircuitJson);
        leaderNoir = new Noir(leaderCircuitJson);
    });

    it('produces a WorkerTask proof and verifies it recursively in LeaderAggregator', async () => {
        jest.setTimeout(300000);

        // Step 1: Compute pedersen hash
        const bb = await Barretenberg.new({ threads: 1 });
        const secret = 42n;
        const secretBuffer = toBuffer32(secret);
        const pedersen = await bb.pedersenHash({ inputs: [secretBuffer], hashIndex: 0 });
        const hExpected = '0x' + Buffer.from(pedersen. hash).toString('hex');

        // Step 2: Generate worker proof
        const workerBackend = new UltraHonkBackend(workerCircuitJson.bytecode, { threads: 4 }, { recursive: true });

        const { witness: workerWitness } = await workerNoir.execute({
            secret: secret. toString(),
            h_expected: hExpected,
        });

        const workerProofData = await workerBackend.generateProof(workerWitness, { keccakZK: true });
        const workerVk = await workerBackend.getVerificationKey({ keccakZK:  true });

        // Use acirVkAsFieldsUltraHonk like the example does (NOT deflattenFields)
        const vkAsFields = (await bb.acirVkAsFieldsUltraHonk(new RawBuffer(workerVk)))
            .map(field => field.toString());

        const proofFields = deflattenFields(workerProofData.proof);

        console.log('VK fields length:', vkAsFields.length);
        console.log('Proof fields length:', proofFields.length);

        expect(vkAsFields. length).toBe(HONK_VK_SIZE);
        expect(proofFields.length).toBe(HONK_PROOF_SIZE);

        // Destroy worker backend before creating leader backend
        await workerBackend.destroy();

        // Step 3: Generate leader proof
        const recursiveInputs = {
            verification_key: vkAsFields,
            proof: proofFields,
            public_inputs: [hExpected],
        };

        const { witness: leaderWitness } = await leaderNoir.execute(recursiveInputs);

        const leaderBackend = new UltraHonkBackend(leaderCircuitJson.bytecode, { threads: 4 }, { recursive: false });

        const leaderProofData = await leaderBackend.generateProof(leaderWitness);
        const verified = await leaderBackend.verifyProof(leaderProofData);

        await leaderBackend.destroy();
        await bb.destroy();

        expect(verified).toBe(true);
    });
});