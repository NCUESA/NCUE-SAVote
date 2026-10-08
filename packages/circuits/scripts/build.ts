import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';

const BUILD_DIR = path.join(__dirname, '../build');
const SRC_DIR = path.join(__dirname, '../src');
const WEB_PUBLIC_ZK_DIR = path.join(__dirname, '../../../apps/web/public/zk');
const PTAU_URL = 'https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau'; // Upgraded to 15 just in case (32k constraints)
const PTAU_FILE = path.join(BUILD_DIR, 'powersOfTau28_hez_final_15.ptau');
const CIRCUIT_NAME = 'main';

// Ensure build directory exists
if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
}

// Ensure web public zk directory exists
if (!fs.existsSync(WEB_PUBLIC_ZK_DIR)) {
    fs.mkdirSync(WEB_PUBLIC_ZK_DIR, { recursive: true });
}

const run = (command: string) => {
    console.log(`Running: ${command}`);
    try {
        execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    } catch (e) {
        console.error(`Error running command: ${command}`);
        process.exit(1);
    }
};

const downloadFile = (url: string, dest: string) => {
    return new Promise<void>((resolve, reject) => {
        if (fs.existsSync(dest)) {
            console.log(`${dest} already exists. Skipping download.`);
            resolve();
            return;
        }
        console.log(`Downloading ${url} to ${dest}...`);
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                fs.unlink(dest, () => {});
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log('Download completed.');
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
};

const main = async () => {
    // 1. Compile Circuit
    console.log('--- Compiling Circuit ---');
    // Assuming 'circom' is in PATH
    // Adding -l node_modules and -l ../../node_modules to ensure circomlib can be found
    // regardless of where it's hoisted in the pnpm workspace.
    run(`circom src/${CIRCUIT_NAME}.circom --r1cs --wasm --sym --output build -l node_modules -l ../../node_modules`);

    // 2. Download PTAU
    console.log('--- Checking Powers of Tau ---');
    await downloadFile(PTAU_URL, PTAU_FILE);

    // 3. Setup (Groth16)
    console.log('--- Generating zKey (Phase 2) ---');
    const r1csFile = path.join(BUILD_DIR, `${CIRCUIT_NAME}.r1cs`);
    const zkeyFile = path.join(BUILD_DIR, `${CIRCUIT_NAME}_0000.zkey`);
    const finalZkeyFile = path.join(BUILD_DIR, `${CIRCUIT_NAME}_final.zkey`);
    
    // 3.1 Setup（phase 2 的起點）
    run(`npx snarkjs groth16 setup ${r1csFile} ${PTAU_FILE} ${zkeyFile}`);

    // 3.2 貢獻
    //
    // ─────────────────────────────────────────────────────────────────────────
    // 原本這裡寫的是：
    //     -e="some random entropy"
    //
    // 那串字就放在這個公開倉庫的原始碼裡。Groth16 的 phase 2 貢獻會從
    // entropy 推導出所謂的 toxic waste；只要知道 toxic waste，就可以對
    // 「任意」公開輸入偽造出通過驗證的證明 —— 也就是在不知道任何人 secret
    // 的情況下，替別人投票。
    //
    // 更糟的是 main_0000.zkey（貢獻前的 zkey）當時也被放在 apps/web/public/
    // 底下對外提供下載，等於把重建 toxic waste 所需的兩樣東西都公開了。
    //
    // 改為每次建置都從作業系統的 CSPRNG 取 64 bytes。這個值不落地、
    // 不進版控、不印出來。
    // ─────────────────────────────────────────────────────────────────────────
    const entropy = crypto.randomBytes(64).toString('base64');
    run(
        `npx snarkjs zkey contribute ${zkeyFile} ${finalZkeyFile} ` +
        `--name="savote-build-$(date +%s)" -v -e="${entropy}"`,
    );

    // 3.3 Random Beacon
    //
    // 單一貢獻者的 setup，安全性完全取決於「那一位貢獻者真的把 toxic waste
    // 丟掉了」。beacon 是標準收尾步驟：用一個事後才能知道、無法預先操縱的
    // 公開隨機值再貢獻一次，讓最後一輪不存在「知情者」。
    //
    // 正式的校級選舉應該改用可公開查證的信標（例如 drand 的某一輪輸出，
    // 或指定日期的比特幣區塊雜湊），並把該值連同本次 zkey 的雜湊一起公告，
    // 讓任何人都能自行重現驗證金鑰。這裡先用本機隨機值，至少消除
    // 「entropy 寫死在原始碼」這個洞。
    const beacon = crypto.randomBytes(32).toString('hex');
    const beaconZkey = path.join(BUILD_DIR, `${CIRCUIT_NAME}_beacon.zkey`);
    run(
        `npx snarkjs zkey beacon ${finalZkeyFile} ${beaconZkey} ${beacon} 10 ` +
        `-n="savote final beacon"`,
    );
    fs.copyFileSync(beaconZkey, finalZkeyFile);

    // 3.4 驗證整條 setup 鏈
    // 這一步會檢查每一次貢獻都是對前一份 zkey 正確地做出來的。
    run(`npx snarkjs zkey verify ${r1csFile} ${PTAU_FILE} ${finalZkeyFile}`);

    // 貢獻前的 zkey 不該留下來 —— 它配上已知的 entropy 就能還原 toxic waste
    fs.rmSync(zkeyFile, { force: true });
    fs.rmSync(beaconZkey, { force: true });

    // 4. Export Verification Key
    console.log('--- Exporting Verification Key ---');
    const vKeyFile = path.join(BUILD_DIR, 'verification_key.json');
    run(`npx snarkjs zkey export verificationkey ${finalZkeyFile} ${vKeyFile}`);

    // 5. 複製產物到前端
    //
    // 前端 useVoteProof 讀的是 /main.wasm 與 /main_final.zkey（public 根目錄），
    // 但原本這裡是複製到 public/zk/vote.wasm 與 public/zk/vote_final.zkey ——
    // 兩邊從來沒對上，實際被使用的是手動放進 public/ 的舊檔案。
    // 這正是舊電路沒有隨 build 更新的原因。
    console.log('--- Copying artifacts to Web ---');

    const wasmSource = path.join(BUILD_DIR, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`);
    const webPublic = path.join(__dirname, '../../../apps/web/public');

    fs.copyFileSync(wasmSource, path.join(webPublic, 'main.wasm'));
    console.log(`Copied -> apps/web/public/main.wasm`);

    fs.copyFileSync(finalZkeyFile, path.join(webPublic, 'main_final.zkey'));
    console.log(`Copied -> apps/web/public/main_final.zkey`);

    // 驗證金鑰：後端用來驗證證明
    const apiKeysDir = path.join(__dirname, '../../../apps/api/src/zk/keys');
    fs.mkdirSync(apiKeysDir, { recursive: true });
    fs.copyFileSync(vKeyFile, path.join(apiKeysDir, 'verification_key.json'));
    console.log(`Copied -> apps/api/src/zk/keys/verification_key.json`);

    const cryptoLibDest = path.join(__dirname, '../../crypto-lib/src/verification_key.json');
    fs.copyFileSync(vKeyFile, cryptoLibDest);
    console.log(`Copied -> packages/crypto-lib/src/verification_key.json`);

    console.log('--- Build Complete ---');
};

main().catch(console.error);