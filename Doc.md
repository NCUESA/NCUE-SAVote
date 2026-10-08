# NCUESA 學生會選舉系統開發文件

> 本文件描述的是**目前實際運作的系統**。舊版文件描述了以 Merkle tree 為核心的設計，但那套設計從未實作；
> 本版已改寫為與程式碼一致，並把尚未實作的部分獨立列在「待實作」，避免與現況混淆。

## 1. 系統概述

SAVote 結合中心化身分驗證（校園 SSO）與 Groth16 零知識證明。零知識證明在這裡的用途是：
讓伺服器確認「送出這張票的人持有一把已登記的投票金鑰，而且這張票是為這一場選舉、這一份內容所產生的」，
同時不需要選民在投票時出示金鑰本身。

### 核心技術

- **Frontend**：React 18、Vite、Tailwind CSS 4
- **Backend**：NestJS、Prisma ORM、openid-client
- **Database**：PostgreSQL 16
- **Zero Knowledge Proof**：Circom 2.1、snarkjs、Groth16（BN254 / bn128）
- **Infrastructure**：Docker Compose、Nginx

---

## 2. 投票流程

### 2.1 實際流程

1. **登入**
   學生以校園 SSO 登入。後端取得學號，計算 `studentIdHash = SHA-256(學號)`，簽發 JWT。

2. **確認資格**（`POST /voters/verify-eligibility`）
   以 `studentIdHash` 比對該場選舉的 `eligible_voters`。

3. **登記投票金鑰**（`POST /voters/register-commitment`）
   - 瀏覽器產生 31 bytes 隨機 `secret`，**只存在該瀏覽器的 localStorage**（鍵名 `savote_secret_<electionId>`）。
   - 計算 `commitment = Poseidon(studentIdHash, secret)` 送交後端，存入 `user_vote_key`。
   - 每位選民每場選舉只能登記一次。

4. **加密選票**
   以該場選舉的 RSA-OAEP 公開金鑰加密候選人 ID（廢票為 `"0"`），得到 `voteContent`。
   再計算 `voteHash = SHA-256(voteContent)` 的前 248 bits。

5. **產生證明**（Web Worker，於選民裝置上）
   輸入 `{ studentId, secret, electionId, voteHash }`，輸出證明與四個公開訊號。

6. **送出**（`POST /votes/submit`，需登入）
   後端依序檢查：
   1. 公開訊號格式（四個十進位數字字串）
   2. `electionId` 公開訊號 = 本次送出的選舉
   3. `voteHash` 公開訊號 = 重新計算的 `SHA-256(voteContent)`
   4. Groth16 證明本身
   5. `commitment` 已在本場選舉登記且尚未投票
   6. 在同一個交易中核銷投票資格並寫入選票；`(electionId, nullifier)` 唯一約束作為最後一道防線

7. **開票**（`GET /elections/:id/admin-summary`，選舉結束後、管理員）
   以資料庫中的 RSA 私鑰解密每張選票並計票。

### 2.2 已知限制

- **選票與選民之間仍可關聯。** 第 6 步以 `commitment` 查詢資格，而 `user_vote_key` 同時存有 `hashedID` 與 `commitment`。
  加上核銷資格與寫入選票發生在同一個交易，有資料庫存取權的人可以從時間或對照關係推回選民。
  要切斷這條線見第 7 節。
- **投票金鑰只存在單一瀏覽器。** 選民換裝置、換瀏覽器或清除瀏覽資料後將無法完成投票，也無法重新登記。
- **開票私鑰與選票存在同一個資料庫。**
- `studentIdHash` 是未加鹽的 SHA-256。學號空間很小，可被暴力反推。

### 2.3 模組職責

| 模組 | 職責 |
| --- | --- |
| `auth` | OIDC 登入、JWT 簽發與更新、session 管理（資料庫只存 token 的 SHA-256 雜湊） |
| `voters` | 選舉人名冊匯入、資格確認、投票金鑰登記 |
| `votes` | 證明驗證、綁定檢查、核銷資格與寫入選票 |
| `elections` | 選舉與候選人 CRUD、開票、抽獎 |
| `admins` | 管理員名單、OIDC 設定 |

---

## 3. 零知識證明電路

原始碼：`packages/circuits/src/vote.circom`

### 3.1 輸入與輸出

| 訊號 | 類型 | 說明 |
| --- | --- | --- |
| `studentId` | Private input | `SHA-256(學號)` 轉成的體元素 |
| `secret` | Private input | 選民本機產生的 248 bits 隨機值 |
| `electionId` | **Public input** | 選舉 UUID 轉成的體元素 |
| `voteHash` | **Public input** | `SHA-256(選票密文)` 的前 248 bits |
| `commitment` | **Public output** | `Poseidon(studentId, secret)` |
| `nullifier` | **Public output** | `Poseidon(secret, electionId)` |

公開訊號順序（circom 規則：先 outputs、再 public inputs）：

```
[0] commitment   [1] nullifier   [2] electionId   [3] voteHash
```

### 3.2 每個訊號存在的理由

- **`nullifier`** 讓重複投票可以在不知道是誰的情況下被擋下。同一位選民在同一場選舉永遠得到同一個值；
  換一場選舉就完全不同，因此無法跨選舉關聯。刻意不把 `studentId` 放進 nullifier，
  因為學號空間小，混進去只會多一條可被暴力搜尋的線索。
- **`electionId`** 防止把同一份證明拿到另一場選舉重放。
- **`voteHash`** 防止攔截到證明的人把選票內容換掉再送。它在電路中以一個平方約束固定住，
  否則 circom 會在編譯期把未被使用的訊號優化掉，綁定就失效。

### 3.3 Trusted setup

`packages/circuits/scripts/build.ts` 的流程：

1. `groth16 setup`（以 `powersOfTau28_hez_final_15.ptau` 為基礎）
2. Phase 2 貢獻：entropy 取自作業系統 CSPRNG（64 bytes），不落地、不進版控
3. Random beacon 收尾
4. `zkey verify` 驗證整條 setup 鏈
5. 刪除貢獻前的 zkey

**正式校級選舉建議**：beacon 改用可公開查證的值（例如 drand 某一輪或指定日期的比特幣區塊雜湊），
並公告該值與最終 zkey 的雜湊，讓任何人都能自行重現驗證金鑰。

### 3.4 前後端必須一致的換算

| 換算 | 前端 | 後端 |
| --- | --- | --- |
| UUID → `electionId` | `apps/web/src/lib/zk.ts` `electionIdToField` | `apps/api/src/utils/zk-utils.ts` `electionIdToField` |
| 密文 → `voteHash` | `computeVoteHash`（WebCrypto） | `voteHashOf`（node:crypto） |

兩邊不一致時，所有選票都會在伺服器端被判定為綁定不符。

---

## 4. 資料庫

### 4.1 與投票相關的資料表

| 資料表 | 關鍵欄位 | 說明 |
| --- | --- | --- |
| `eligible_voters` | `studentId`、`studentIdHash`、`electionId` | 選舉人名冊 |
| `user_vote_key` | `hashedID`、`electionId`、`commitment`、`hasVoted`、`votedAt` | 投票金鑰登記與核銷狀態 |
| `votes` | `electionId`、`voteContent`、`nullifier`、`proof` | 選票。與 `users` 無外鍵關聯 |
| `elections` | `publicKey`、`privateKey`、`finalResult` | `privateKey` 永遠不回傳給客戶端 |
| `sessions` | `jti`、`accessToken`、`refreshToken` | token 欄位只存 SHA-256 雜湊 |

### 4.2 唯一約束

- `votes (electionId, nullifier)`：同一場選舉同一個 nullifier 只能出現一次。
  電路升級前的選票 `nullifier` 為 NULL，Postgres 視每個 NULL 為相異值，不會衝突。
- `user_vote_key (hashedID, electionId)`：每位選民每場選舉只能登記一次。

### 4.3 結構變更的部署方式

`docker-compose.yml` 啟動時執行 `prisma db push`，**刻意不帶 `--accept-data-loss`**：
遇到會刪除資料的結構差異時，部署會中止而不是默默刪資料。

新增唯一約束也會被 Prisma 視為需要確認的操作，因此 `safe-redeploy.sh` 會在部署前先以冪等 SQL 建好欄位與索引，
讓 `db push` 成為 no-op。索引名稱必須遵循 Prisma 的預設命名 `<資料表>_<欄位1>_<欄位2>_key`。

---

## 5. API

### Auth
- `GET  /api/auth/login`：學生 SSO 登入
- `GET  /api/auth/admin/login`：管理員 Keycloak 登入
- `GET  /api/auth/callback`、`/api/auth/admin/callback`：OIDC 回呼
- `POST /api/auth/refresh`：更新 token
- `POST /api/auth/logout`：登出（需登入）
- `GET  /api/users/me`：目前使用者（需登入）

### Elections
- `GET  /api/elections`、`/api/elections/visible`、`/api/elections/:id`：選舉資訊（**不含 `privateKey`**）
- `POST /api/elections`、`PATCH /api/elections/:id`、`DELETE /api/elections/:id`：管理員；選舉開始後不可修改或刪除
- `GET  /api/elections/:id/candidates`：候選人
- `GET  /api/elections/:id/admin-summary`：開票（管理員、選舉結束後）
- `GET  /api/elections/:id/results`：公開結果（開票完成後）
- `GET  /api/elections/:id/lottery/draw`、`/lottery`：抽獎

### Voters
- `POST /api/voters/import`：匯入選舉人名冊 CSV（管理員）
- `POST /api/voters/verify-eligibility`：確認投票資格（需登入）
- `POST /api/voters/register-commitment`：登記投票金鑰（需登入）

### Votes
- `POST /api/votes/submit`：送出選票（需登入）。失敗時如實回報錯誤碼，不會回傳假的成功。

---

## 6. 選舉制度與門檻

> ⚠️ **待確認**：以下是**程式碼目前實際執行的規則**（`packages/shared-types/src/election-rules.config.ts`
> 與 `apps/api/src/elections/elections.service.ts` 的 `evaluateElectionRules`）。
> 舊版文件記載的門檻與此不同（見各項註記），兩者會產生不同的當選結果。
> 請對照《國立彰化師範大學學生會選舉罷免暨推舉自治條例》確認何者正確，並修正錯的那一邊。

### 正、副會長

- 單一選區，一人一票。
- **同額競選（僅一組候選人）**：得票需達**總選舉人數 5%** 以上始當選。
  *舊版文件記載為 10%。*
- **非同額競選**：相對多數，得票最多者當選。

### 選區學生議員

- 相對多數，得票最多者當選。一人一票。

### 不分區學生議員

- 得票需達**有效票數 1%** 以上，取符合門檻且票數最高的前 **16** 人。
  *舊版文件記載為「總選舉人數 1%」。兩者分母不同：以 17,232 位選舉人、約 3,000 張有效票計算，
  前者門檻約 173 票，後者約 30 票。*

### 廢票

- 選民可明確選擇「均不圈選」，以 `"0"` 加密送出，開票時計為廢票，不計入任何候選人。
- 解密後的候選人 ID 不屬於本場選舉時計為「不合法票」。

---

## 7. 待實作：切斷選民與選票的關聯

目前的設計在投票時以 `commitment` 查詢資格（見 2.2）。要讓伺服器無從得知哪一張票屬於哪一位選民，需要：

1. 投票開始時，以本場所有已登記的 commitment 建立 Merkle tree，公告 root。
2. 電路改為證明「我的 commitment 是這棵樹的一片葉子」，公開輸入改為 `root` 而不是 `commitment`。
3. 後端只檢查 `root` 與 `nullifier`，**不再查詢 commitment**。

以 17,232 位選舉人計算，樹深 15 已足夠，約增加 3,600 個約束，仍在目前 ptau（2^15）的容量內。
更換電路需要所有選民重新登記投票金鑰，**只能在沒有進行中選舉的期間進行**。

---

## 8. References

- [Groth16 數學理論](https://www.zeroknowledgeblog.com/index.php/groth16)
- [Quadratic Arithmetic Programs: from Zero to Hero](https://medium.com/@VitalikButerin/quadratic-arithmetic-programs-from-zero-to-hero-f6d558cea649)
- [Powers of Tau Groth16 Trusted Setup](https://aping-dev.com/index.php/archives/781/)
- [開發完整文檔（HackMD）](https://hackmd.io/@NCUESA/H1wtzaYKex)
- [測試用 SSO Server](https://dsm.ncuesa.org.tw/#/signin)
