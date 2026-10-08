pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/*
 * SAVote 投票證明電路
 * =============================================================================
 *
 * 證明的內容：「我知道某個 commitment 的原像 (studentId, secret)」，
 * 同時輸出一個與該選民、該場選舉綁定的 nullifier。
 *
 * 相對於前一版的三個關鍵改動：
 *
 * 1. nullifier
 *    前一版只有 commitment 一個公開輸出。伺服器必須靠「查出這個 commitment
 *    有沒有投過票」來擋重複投票，而 commitment 在資料庫裡直接對應到
 *    hashedID —— 防重複投票的機制本身就是去匿名的來源。
 *
 *    nullifier = Poseidon(secret, electionId) 對同一位選民、同一場選舉
 *    是固定值，對不同場選舉則完全不同，而且從 nullifier 反推不出 secret
 *    或身分。伺服器只要記住「這個 nullifier 用過了」即可。
 *
 * 2. electionId 綁定
 *    前一版的證明完全沒有提到是哪一場選舉。同一份證明在任何一場選舉都成立，
 *    只要該 commitment 在那場選舉也有登記，就能被重放。
 *
 * 3. voteHash 綁定
 *    前一版的證明與選票內容無關。任何攔截到 (proof, publicSignals) 的人
 *    —— 中間人、伺服器端的惡意程式、日誌讀取者 —— 都可以把 voteContent
 *    換成別的候選人後重送，證明照樣通過。
 *    把選票密文的雜湊納入公開輸入之後，證明就只對那一張特定的選票有效。
 *
 * -----------------------------------------------------------------------------
 * 公開訊號順序（circom 規則：先 outputs 再 public inputs，各自依宣告順序）：
 *   [0] commitment
 *   [1] nullifier
 *   [2] electionId
 *   [3] voteHash
 * -----------------------------------------------------------------------------
 */
template Vote() {
    // ---- 私密輸入：永遠不離開選民的裝置 ----
    signal input studentId;   // SHA-256(學號) 轉成的體元素
    signal input secret;      // 選民在本機產生的 31 bytes 隨機值

    // ---- 公開輸入 ----
    signal input electionId;  // UUID 轉成的體元素
    signal input voteHash;    // SHA-256(選票密文) 取前 248 bits

    // ---- 公開輸出 ----
    signal output commitment;
    signal output nullifier;

    // commitment = Poseidon(studentId, secret)
    // 與選民註冊時在本機算出、送交伺服器的那一個必須一致。
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== studentId;
    commitmentHasher.inputs[1] <== secret;
    commitment <== commitmentHasher.out;

    // nullifier = Poseidon(secret, electionId)
    // 刻意「不」把 studentId 放進來：nullifier 只需要對
    //（選民, 選舉）這組唯一，混入 studentId 只會多一條可被暴力搜尋的線索
    // —— 學號空間很小，而 secret 是 248 bits 的隨機值。
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== electionId;
    nullifier <== nullifierHasher.out;

    // voteHash 必須真的參與約束，否則 circom 會在編譯期把這個訊號優化掉，
    // 公開輸入就失去綁定效果 —— 攻擊者可以填任意值而證明照樣成立。
    // 一個平方約束就足以把它釘進 R1CS，成本只有 1 個約束。
    signal voteHashBinding;
    voteHashBinding <== voteHash * voteHash;
}
