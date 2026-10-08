import { getRandomBytes } from '../../../lib/crypto';
// @ts-ignore

let poseidon: any;

export async function getPoseidon() {
    if (!poseidon) {
        // 動態 import：避免 2.8 MB 的 circomlibjs 被併進主 bundle
        const { buildPoseidon } = await import('circomlibjs');
        poseidon = await buildPoseidon();
    }
    return poseidon;
}

/**
 * Generates a cryptographically secure random nullifier secret (32 bytes)
 * This secret is used to prove identity without revealing it
 */
export function generateNullifierSecret(): Uint8Array {
  return getRandomBytes(32);
}

/**
 * Converts the nullifier secret to a hex string for storage/display
 */
export function nullifierToHex(secret: Uint8Array): string {
  return Array.from(secret)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts a hex string back to nullifier secret Uint8Array
 */
export function hexToNullifier(hex: string): Uint8Array {
  if (hex.length !== 64) {
    throw new Error('Invalid nullifier hex length');
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function generateIdentityCommitment(studentIdHash: string, secret: string): Promise<string> {
    const p = await getPoseidon();
    // inputs: [studentIdHash, secret]
    const hash = p([BigInt('0x' + studentIdHash), BigInt('0x' + secret)]);
    return p.F.toString(hash);
}

export async function generateNullifierHash(secret: string, electionId: string): Promise<string> {
    const p = await getPoseidon();
    // inputs: [secret, electionId]
    const electionIdBigInt = BigInt('0x' + electionId.replace(/-/g, ''));
    const hash = p([BigInt('0x' + secret), electionIdBigInt]);
    return p.F.toString(hash);
}
