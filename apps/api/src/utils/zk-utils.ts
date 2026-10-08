import { createHash } from 'crypto';

/**
 * 與前端 apps/web/src/lib/zk.ts 必須「逐位元一致」的轉換函式。
 * 任何一邊改了，另一邊沒跟著改，所有選票都會驗證失敗。
 */

export const uuidToBigInt = (uuid: string): bigint => {
  const hex = uuid.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) {
    throw new Error(`Invalid UUID: ${uuid}`);
  }
  return BigInt('0x' + hex);
};

export const bigIntToUuid = (bi: string | bigint): string => {
  const hex = BigInt(bi).toString(16).padStart(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** 選舉 UUID → 電路的 electionId 公開輸入（十進位字串） */
export const electionIdToField = (uuid: string): string => uuidToBigInt(uuid).toString();

/**
 * 選票密文 → 電路的 voteHash 公開輸入（十進位字串）。
 *
 * SHA-256 是 256 bits，但 BN254 的純量體只有約 254 bits。取前 31 bytes
 * （248 bits）保證結果一定小於體的模數，不會被電路自動取模而產生碰撞。
 */
export const voteHashOf = (ciphertext: string): string => {
  const hex = createHash('sha256').update(ciphertext, 'utf8').digest('hex');
  return BigInt('0x' + hex.slice(0, 62)).toString();
};
