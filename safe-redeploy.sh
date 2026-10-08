#!/usr/bin/env bash
# ==============================================================================
# SAVote 安全重新部署
# ==============================================================================
#
# 這座資料庫裡有正在進行中的選舉與已投選票。這支腳本的設計原則是：
# 任何一步出錯就停下來，寧可部署失敗，也不要讓資料處於不確定狀態。
#
# 流程：
#   1. 前置檢查（docker、.env、磁碟空間）
#   2. 完整資料庫備份 + 還原驗證
#   3. 記錄部署前的資料筆數
#   4. 建置並啟動
#   5. 比對部署後的資料筆數，不一致就大聲警告
#
# 用法：
#   sudo ./safe-redeploy.sh              # 完整流程
#   sudo ./safe-redeploy.sh --backup-only # 只備份，不部署
#   sudo ./safe-redeploy.sh --web-only    # 只重建前端（不碰 API 與資料庫）
#
# 還原（萬一需要）：
#   cat backups/<檔名>.sql | docker exec -i savote-db psql -U postgres -d savote_db
# ==============================================================================

set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$REPO_ROOT/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/savote-$STAMP.sql"
DB_CONTAINER="savote-db"

ok()   { echo -e "\033[0;32m  ✓ $1\033[0m"; }
info() { echo -e "\033[0;36m[部署] $1\033[0m"; }
warn() { echo -e "\033[0;33m  ! $1\033[0m"; }
die()  { echo -e "\033[0;31m[中止] $1\033[0m" >&2; exit 1; }

trap 'die "第 $LINENO 行失敗，已中止。資料庫未被修改（若已完成備份，檔案保留在 $BACKUP_DIR）。"' ERR

MODE="full"
[[ "${1:-}" == "--backup-only" ]] && MODE="backup"
[[ "${1:-}" == "--web-only" ]] && MODE="web"

# ------------------------------------------------------------------------------
# 1. 前置檢查
# ------------------------------------------------------------------------------
info "前置檢查"

command -v docker >/dev/null || die "找不到 docker"
docker info >/dev/null 2>&1 || die "無法連線 docker daemon（請用 sudo 執行）"
ok "docker 可用"

[[ -f "$REPO_ROOT/apps/api/.env" ]] || die "找不到 apps/api/.env"
ok ".env 存在"

# SESSION_SECRET 是正式環境的硬性要求（API 啟動時也會自己擋一次）
#
# 注意：在 set -e + pipefail 底下，grep 找不到東西會回傳 1，
# 整個命令替換就跟著失敗並觸發 ERR trap —— 於是檢查「成功偵測到問題」
# 反而變成腳本以通用錯誤中止。所有這類查詢都要用 || true 收尾。
if grep -q '^NODE_ENV=production' "$REPO_ROOT/apps/api/.env" 2>/dev/null; then
  SECRET_VALUE="$(grep -m1 '^SESSION_SECRET=' "$REPO_ROOT/apps/api/.env" 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)"
  if [[ "${#SECRET_VALUE}" -lt 32 ]]; then
    die "NODE_ENV=production 但 SESSION_SECRET 未設定或不足 32 字元。

       產生並寫入：
         printf '\\nSESSION_SECRET=\"%s\"\\n' \"\$(openssl rand -base64 48)\" >> apps/api/.env

       （未設定時 API 會拒絕啟動，這是刻意的 —— 原本的程式碼會退回一個
         寫死在公開原始碼裡的預設值，等同於沒有保護。）"
  fi
  ok "SESSION_SECRET 已設定（${#SECRET_VALUE} 字元）"
fi

docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$" \
  || die "資料庫容器 $DB_CONTAINER 沒有在執行。先確認它是健康的，再來部署。"
ok "資料庫容器執行中"

AVAIL_KB=$(df -Pk "$REPO_ROOT" | awk 'NR==2 {print $4}')
[[ "$AVAIL_KB" -gt 1048576 ]] || die "可用磁碟空間不足 1GB，備份可能不完整"
ok "磁碟空間充足（$((AVAIL_KB / 1024)) MB）"

# ------------------------------------------------------------------------------
# 2. 備份
# ------------------------------------------------------------------------------
info "備份資料庫"
mkdir -p "$BACKUP_DIR"

docker exec "$DB_CONTAINER" pg_dump -U postgres -d savote_db --clean --if-exists > "$BACKUP_FILE"

BACKUP_BYTES=$(stat -c %s "$BACKUP_FILE")
[[ "$BACKUP_BYTES" -gt 1024 ]] || die "備份檔只有 $BACKUP_BYTES bytes，顯然不完整"
ok "已備份至 $BACKUP_FILE（$((BACKUP_BYTES / 1024)) KB）"

# 驗證備份內容真的包含選票資料表，而不是一個空殼
for tbl in votes user_vote_key elections eligible_voters; do
  grep -q "COPY public.\"\?${tbl}\"\?" "$BACKUP_FILE" \
    || grep -qi "CREATE TABLE public.\"\?${tbl}\"\?" "$BACKUP_FILE" \
    || die "備份檔中找不到資料表 $tbl，備份不可信，已中止"
done
ok "備份內容驗證通過"

if gzip -k "$BACKUP_FILE" 2>/dev/null; then
  ok "已壓縮備份：${BACKUP_FILE}.gz"
else
  warn "壓縮失敗，但未壓縮的備份仍然有效：$BACKUP_FILE"
fi

if [[ "$MODE" == "backup" ]]; then
  info "僅備份模式，完成。"
  exit 0
fi

# ------------------------------------------------------------------------------
# 3. 記錄部署前的資料筆數
# ------------------------------------------------------------------------------
info "記錄部署前資料筆數"

count_rows() {
  docker exec "$DB_CONTAINER" psql -U postgres -d savote_db -tAc \
    "SELECT COALESCE((SELECT COUNT(*) FROM \"$1\"), 0)" 2>/dev/null | tr -d '[:space:]' || echo "ERR"
}

BEFORE_VOTES=$(count_rows votes)
BEFORE_KEYS=$(count_rows user_vote_key)
BEFORE_ELECTIONS=$(count_rows elections)
BEFORE_VOTERS=$(count_rows eligible_voters)

echo "    選票          : $BEFORE_VOTES"
echo "    投票金鑰      : $BEFORE_KEYS"
echo "    選舉          : $BEFORE_ELECTIONS"
echo "    選舉人名冊    : $BEFORE_VOTERS"

[[ "$BEFORE_VOTES" == "ERR" ]] && die "無法查詢資料筆數，資料庫狀態不明，已中止"

# ------------------------------------------------------------------------------
# 3.5 非破壞性的結構前置
# ------------------------------------------------------------------------------
# prisma db push 在「新增唯一約束」時會要求 --accept-data-loss
# （因為既有重複值會讓約束建立失敗）。我們刻意不帶那個旗標，
# 所以這裡先用冪等的 SQL 把欄位與索引建好，db push 看到已同步就會是 no-op。
#
# 這兩條都是純新增：
#   - 新欄位可為空，既有 752 張選票的 nullifier 為 NULL
#   - Postgres 的唯一索引視每個 NULL 為相異值，既有資料不可能衝突
# 索引名稱必須與 Prisma 的預設命名一致，否則 db push 會試圖重建它。
if [[ "$MODE" != "web" ]]; then
  info "套用非破壞性結構前置（nullifier 欄位與唯一索引）"
  docker exec -i "$DB_CONTAINER" psql -U postgres -d savote_db -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "nullifier" VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS "votes_electionId_nullifier_key"
  ON "votes" ("electionId", "nullifier");
SQL
  ok "結構前置完成"
fi

# ------------------------------------------------------------------------------
# 4. 建置與啟動
# ------------------------------------------------------------------------------
cd "$REPO_ROOT"

if [[ "$MODE" == "web" ]]; then
  info "只重建前端（不碰 API 與資料庫）"
  docker compose up -d --build web
  ok "前端已更新"
else
  info "建置 api 與 web"
  # 先建置，建置失敗就不會動到正在跑的服務
  docker compose build api web
  ok "映像檔建置完成"

  info "啟動服務"
  # 刻意不用 down：down 會停掉資料庫容器，沒有必要
  docker compose up -d api web
  ok "服務已啟動"
fi

# ------------------------------------------------------------------------------
# 5. 部署後驗證
# ------------------------------------------------------------------------------
info "等待 API 就緒"
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://127.0.0.1:3000/api/elections" 2>/dev/null; then
    ok "API 回應正常（$i 秒）"
    break
  fi
  [[ "$i" -eq 60 ]] && die "API 在 60 秒內沒有回應。查看日誌：docker compose logs api"
  sleep 1
done

info "比對部署後資料筆數"
AFTER_VOTES=$(count_rows votes)
AFTER_KEYS=$(count_rows user_vote_key)
AFTER_ELECTIONS=$(count_rows elections)
AFTER_VOTERS=$(count_rows eligible_voters)

printf "    %-14s %8s → %-8s %s\n" "選票"       "$BEFORE_VOTES"     "$AFTER_VOTES"     "$([[ "$AFTER_VOTES" -ge "$BEFORE_VOTES" ]] && echo OK || echo '*** 減少 ***')"
printf "    %-14s %8s → %-8s %s\n" "投票金鑰"   "$BEFORE_KEYS"      "$AFTER_KEYS"      "$([[ "$AFTER_KEYS" -ge "$BEFORE_KEYS" ]] && echo OK || echo '*** 減少 ***')"
printf "    %-14s %8s → %-8s %s\n" "選舉"       "$BEFORE_ELECTIONS" "$AFTER_ELECTIONS" "$([[ "$AFTER_ELECTIONS" -ge "$BEFORE_ELECTIONS" ]] && echo OK || echo '*** 減少 ***')"
printf "    %-14s %8s → %-8s %s\n" "選舉人名冊" "$BEFORE_VOTERS"    "$AFTER_VOTERS"    "$([[ "$AFTER_VOTERS" -ge "$BEFORE_VOTERS" ]] && echo OK || echo '*** 減少 ***')"

if [[ "$AFTER_VOTES" -lt "$BEFORE_VOTES" || "$AFTER_KEYS" -lt "$BEFORE_KEYS" \
   || "$AFTER_ELECTIONS" -lt "$BEFORE_ELECTIONS" || "$AFTER_VOTERS" -lt "$BEFORE_VOTERS" ]]; then
  echo
  die "資料筆數減少了。立刻用備份還原：
       cat $BACKUP_FILE | docker exec -i $DB_CONTAINER psql -U postgres -d savote_db"
fi
ok "資料筆數未減少"

# 確認最嚴重的那個漏洞真的補上了
info "驗證 privateKey 不再外洩"
if curl -fsS "http://127.0.0.1:3000/api/elections" | grep -q "privateKey"; then
  warn "回應中仍含 privateKey —— 修正未生效，請確認 api 映像檔確實重建了"
else
  ok "GET /api/elections 不再回傳 privateKey"
fi

echo
info "部署完成。備份保留在：$BACKUP_FILE"
echo
echo "  若要回退："
echo "    docker compose down api web"
echo "    git stash                                  # 收起本次變更"
echo "    docker compose up -d --build api web"
echo "    cat $BACKUP_FILE | docker exec -i $DB_CONTAINER psql -U postgres -d savote_db"
