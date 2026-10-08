# SAVote

**國立彰化師範大學學生會 學生選舉系統**

以 Groth16 零知識證明驗證投票資格、選票於選民裝置上加密後送出的線上投票系統。

---

## 系統做到什麼、沒做到什麼

這一節刻意寫得直白。選舉系統對外宣稱的安全性必須與實作一致。

**做到的**

- **投票資格驗證**：學生以校園 SSO 登入，系統比對選舉人名冊確認資格。學生的校園密碼由學校的登入系統處理，本系統不經手。
- **選票加密**：選票在選民的瀏覽器裡以該場選舉的 RSA-OAEP 公開金鑰加密後才送出。伺服器在開票前無法讀取選票內容。
- **防止重複投票**：每張選票附帶一個 nullifier（`Poseidon(secret, electionId)`），資料庫以 `(electionId, nullifier)` 唯一約束擋下第二張票。
- **防止證明被挪用**：零知識證明同時綁定「這一場選舉」與「這一張選票的密文雜湊」。攔截到的證明無法拿去別場選舉重放，也無法把選票內容換掉再送。

**還沒做到的**

- **選民與選票之間並非完全無法關聯。** 投票時伺服器會以選民的 commitment 查詢資格，而資料庫同時存有 `hashedID ↔ commitment` 的對應。有資料庫存取權的人仍可能把選票與選民連起來。要真正切斷這條線，需要改為 Merkle tree 成員證明（見 `Doc.md` 第 3 節）。
- **沒有分散式帳本，也沒有公開可稽核的投票紀錄。** 選票存在 PostgreSQL。
- **開票私鑰存在資料庫。** 能讀取 `elections.privateKey` 的人可以解密所有選票。

---

## 身分入口

| 對象 | 登入方式 | 授權依據 |
| :--- | :--- | :--- |
| 學生 | 校園 SSO（OIDC） | 該場選舉的選舉人名冊 |
| 管理員 | 學生會 Keycloak（OIDC） | 系統內的管理員名單（`admin_permissions`） |

管理員登入後介面只顯示管理功能，不顯示投票功能。

---

## 首次部署

```bash
git clone https://github.com/NCUESA/SAVote.git
cd SAVote

cp apps/api/.env.example apps/api/.env
# 編輯 .env，至少填入下方「必要環境變數」

chmod +x deploy.sh
sudo ./deploy.sh
```

`deploy.sh` 會安裝 circom、產生 JWT 金鑰、編譯 ZK 電路並啟動所有容器。

## 更新已在運作的系統

**不要直接 `docker compose up --build`。** 請使用：

```bash
sudo ./safe-redeploy.sh               # 完整更新
sudo ./safe-redeploy.sh --backup-only # 只備份
sudo ./safe-redeploy.sh --web-only    # 只更新前端
```

這支腳本會先完整備份資料庫並驗證備份內容，記錄部署前各資料表筆數，建置成功後才替換正在運作的服務，最後比對筆數 —— 只要有任何一張表的資料減少就中止並給出還原指令。備份存在 `backups/`（已排除於 git 與 Docker 映像檔之外）。

---

## 必要環境變數（`apps/api/.env`）

| 變數 | 說明 |
| :--- | :--- |
| `SESSION_SECRET` | **必填，至少 32 字元。** 正式環境未設定時 API 會拒絕啟動。產生：`openssl rand -base64 48` |
| `VOTER_OIDC_ISSUER` / `_CLIENT_ID` / `_CLIENT_SECRET` | 學生 SSO |
| `ADMIN_OIDC_ISSUER` / `_CLIENT_ID` / `_CLIENT_SECRET` | 管理員 Keycloak（Issuer 格式：`https://<keycloak>/realms/<realm>`） |
| `ADMIN_OIDC_USERNAME_CLAIM` | 比對管理員名單用的 claim，預設 `preferred_username` |
| `INITIAL_SUPER_ADMIN_SUB` | 預設超級管理員的 Keycloak 帳號名稱 |
| `INITIAL_SUPER_ADMIN_NAME` | 預設超級管理員姓名 |
| `CORS_ORIGIN` | 系統對外網域，例如 `https://sa-election.ncue.edu.tw` |

OIDC 的設定值也可以登入後台後在「系統設定」修改，資料庫中的設定優先於 `.env`。

### 更換資料庫密碼

資料庫密碼由專案根目錄 `.env` 的 `POSTGRES_PASSWORD` 提供給 docker compose（未設定時沿用舊值）。這個值**只在資料庫第一次初始化時生效**，既有資料庫直接改這個變數不會改到密碼，反而會讓 API 連不上。正確順序：

```bash
sudo docker exec -it savote-db psql -U postgres -c "ALTER USER postgres WITH PASSWORD '<新密碼>';"
echo 'POSTGRES_PASSWORD=<新密碼>' | sudo tee -a .env
sudo ./safe-redeploy.sh
```

---

## 網路暴露面

| 服務 | 監聽 | 說明 |
| :--- | :--- | :--- |
| 前端 + API 閘道 | `0.0.0.0:8080` | 由主機的 nginx（`nginx/savote.conf`）反向代理到 443 |
| API | `127.0.0.1:3000` | 僅供主機內除錯；對外流量走 web → api 的 Docker 內網 |
| PostgreSQL | `127.0.0.1:5432` | 僅供主機內維運 |

Swagger API 文件只在非正式環境（`NODE_ENV` 不是 `production`）提供，位於 API 埠的 `/docs`，例如 `http://127.0.0.1:3000/docs`。

---

## 常用維運指令

```bash
sudo docker compose logs -f api                                 # 查看 API 日誌
sudo docker compose restart api                                 # 重啟 API
sudo docker exec -it savote-db psql -U postgres -d savote_db    # 進入資料庫

# 從備份還原
cat backups/<檔名>.sql | sudo docker exec -i savote-db psql -U postgres -d savote_db
```

---

## 管理員權限

- 系統啟動時會自動把 `.env` 的 `INITIAL_SUPER_ADMIN_SUB` 加入超級管理員名單。
- 超級管理員登入後可在「權限管理」新增、移除或調整其他管理員。
- 「權限管理」與「系統設定」僅超級管理員可用。

---

## 修改 ZK 電路

電路原始碼在 `packages/circuits/src/vote.circom`。修改後：

```bash
cd packages/circuits
PATH="$PWD/bin:$PATH" npx tsx scripts/build.ts
```

建置腳本會從作業系統 CSPRNG 取得 phase 2 貢獻的 entropy、加上 random beacon、驗證整條 setup 鏈，然後把產物複製到：

- `apps/web/public/main.wasm`、`apps/web/public/main_final.zkey`（前端產生證明）
- `apps/api/src/zk/keys/verification_key.json`（後端驗證證明）

電路的公開訊號順序一旦改變，前後端都要跟著改。前端 `apps/web/src/lib/zk.ts` 與後端 `apps/api/src/utils/zk-utils.ts` 的 `electionIdToField` 與 voteHash 換算必須逐位元一致。

**不要在選舉進行中更換電路**：已註冊的投票金鑰會全部失效。

---

## 技術架構

| 層 | 技術 |
| :--- | :--- |
| 前端 | React 18、Vite、Tailwind CSS 4 |
| 後端 | NestJS、Prisma、openid-client |
| 資料庫 | PostgreSQL 16 |
| 零知識證明 | Circom 2.1、snarkjs、Groth16（BN254） |
| 部署 | Docker Compose、Nginx |

詳細設計見 [`Doc.md`](Doc.md)。

---

**License**：PolyForm Noncommercial License 1.0.0
