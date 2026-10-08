/**
 * ZK 身分金鑰工具
 *
 * circomlibjs 打包後約 2.8 MB（內含 ffjavascript 與 blake2b）。原本是靜態
 * import，整包會被併進 VotingBooth 的 chunk，行動網路上選舉人要先下載
 * 1.45 MB（gzip）才看得到候選人名單。改為動態 import 後它會成為獨立 chunk，
 * 候選人名單先畫出來，Poseidon 在背景載入。
 *
 * 同時把 buildPoseidon() 的結果快取起來：原本每次呼叫 calculateCommitment
 * 都會重新初始化一次（送一張票會跑兩次）。
 */
let poseidonPromise: Promise<any> | null = null;

const getPoseidon = () => {
  if (!poseidonPromise) {
    poseidonPromise = import('circomlibjs').then((m) => m.buildPoseidon());
  }
  return poseidonPromise;
};

/** 在進入投票頁時先暖身，讓使用者按下送出時不必再等下載 */
export const warmUpPoseidon = () => {
  void getPoseidon().catch(() => {
    // 暖身失敗不影響流程，真正需要時會再試一次
    poseidonPromise = null;
  });
};

const toBigInt = (value: string): bigint => {
  const hex = value.startsWith('0x') ? value : '0x' + value;
  return BigInt(hex);
};

/**
 * 產生符合 ZK 電路要求的隨機 secret。
 * 31 bytes 以確保小於 BN254 的純量體 p。
 */
export const generateZkSecret = (): string => {
  const array = new Uint8Array(31);
  crypto.getRandomValues(array);
  return '0x' + Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
};

/** 計算 commitment = Poseidon(studentIdHash, secret) */
export const calculateCommitment = async (
  studentIdHash: string,
  secret: string,
): Promise<string> => {
  const poseidon = await getPoseidon();
  const hash = poseidon([toBigInt(studentIdHash), toBigInt(secret)]);
  return poseidon.F.toString(hash);
};

/**
 * 以下兩個函式必須與後端 apps/api/src/utils/zk-utils.ts「逐位元一致」。
 * 任何一邊改了另一邊沒跟上，所有選票都會在伺服器端被判定為綁定不符。
 */

/** 選舉 UUID → 電路的 electionId 公開輸入（十進位字串） */
export const electionIdToField = (uuid: string): string => {
  const hex = uuid.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error(`Invalid election id: ${uuid}`);
  return BigInt('0x' + hex).toString();
};

/**
 * 選票密文 → 電路的 voteHash 公開輸入（十進位字串）。
 * 取 SHA-256 前 31 bytes（248 bits），保證小於 BN254 純量體的模數。
 */
export const computeVoteHash = async (ciphertext: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ciphertext));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return BigInt('0x' + hex.slice(0, 62)).toString();
};
