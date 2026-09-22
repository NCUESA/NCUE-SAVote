# SAVote (Secure Anonymous Voting)

**NCUESA 學生會選舉系統 (Decentralized, Privacy-Preserving Voting System)**

SAVote 是一個採用 **Zero-Knowledge Proofs (Groth16)** 技術建構的次世代電子投票平台。

---

## 核心特性

1.  **身份驗證入口分離**: 
    *   **學生**: 透過校園 SSO 登入，僅驗證投票資格。
    *   **管理員**: 直接透過學生會 Keycloak OIDC 登入，並與本地授權名單對照。
2.  **匿名性**: 透過零知識證明，確保伺服器無法追蹤選票與身份的關聯。
3.  **自動化運維**: 透過 Docker 部署，自動完成資料庫遷移與管理員初始化。

---

## 快速開始

```bash
# Clone 專案
git clone https://github.com/NCUESA/SAVote.git
cd SAVote

# 設定環境變數
cp apps/api/.env.example apps/api/.env
# 編輯 .env 填入正確的 OIDC 與網域資訊
```

此腳本會自動檢查環境、產生 RSA 密鑰、編譯電路並啟動 Docker。
```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

---

## 必要環境變數 (`apps/api/.env`)

| 變數名稱 | 說明 |
| :--- | :--- |
| `VOTER_OIDC_ISSUER` | 學生 SSO 發行者 URL |
| `ADMIN_OIDC_ISSUER` | 管理員 Keycloak 發行者 URL (`https://<keycloak>/realms/<realm>`) |
| `ADMIN_OIDC_USERNAME_CLAIM` | 比對授權名單所用的 Claim，預設 `preferred_username` |
| `INITIAL_SUPER_ADMIN_SUB` | 預設超級管理員的 Keycloak 帳號名稱 (username) |
| `INITIAL_SUPER_ADMIN_NAME` | 預設超級管理員姓名 |
| `CORS_ORIGIN` | 系統對外網域 (e.g. https://sa-election.ncue.edu.tw) |

---

## Docker 常用維運指令

*   **查看日誌**: `docker compose logs -f api`
*   **停止服務**: `docker compose down`
*   **重新啟動**: `docker compose restart`
*   **進入資料庫**: `docker exec -it savote-db psql -U postgres -d savote_db`

---

## 系統管理 (Admin)

*   **入口分離**: 管理員登入後，介面將完全隱藏投票功能，僅顯示管理工具。
*   **初次權限**: 系統啟動後，會自動將 `.env` 中的 `INITIAL_SUPER_ADMIN_SUB` 加入超級管理員名單。
*   **Keycloak 串接**: 設定步驟見 [docs/keycloak-admin-sso.md](docs/keycloak-admin-sso.md)。
*   **後續授權**: 超級管理員登入後，可透過「權限管理」選單新增、刪除或提升其他管理員。

---

**License**: PolyForm Noncommercial License 1.0.0
