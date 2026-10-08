/**
 * 日期時間格式化
 *
 * 全站統一使用固定格式，不用 toLocaleString()。
 * 各家瀏覽器與系統語系給出的格式差異很大
 * （「2026/10/15 下午5:00」vs「10/15/2026, 5:00 PM」vs「2026年10月15日 17:00」），
 * 選務資訊不該有這種不確定性 —— 尤其是投票截止時間。
 */

const pad = (n: number) => String(n).padStart(2, '0');

const toDate = (value: string | number | Date | null | undefined): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** 2026/10/15 */
export const formatDate = (value: string | number | Date | null | undefined, fallback = '—') => {
  const d = toDate(value);
  if (!d) return fallback;
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
};

/** 2026/10/15 17:00 */
export const formatDateTime = (value: string | number | Date | null | undefined, fallback = '—') => {
  const d = toDate(value);
  if (!d) return fallback;
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 10/15 17:00 —— 空間有限時使用（例如表格欄位） */
export const formatShortDateTime = (
  value: string | number | Date | null | undefined,
  fallback = '—',
) => {
  const d = toDate(value);
  if (!d) return fallback;
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 17:08:42 —— 給「最後更新時間」這類需要秒數的場合 */
export const formatTime = (value: string | number | Date | null | undefined, fallback = '—') => {
  const d = toDate(value);
  if (!d) return fallback;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/**
 * 把剩餘毫秒轉成人看得懂的粒度：「3 天 4 小時」「2 小時 14 分」「8 分」。
 * 已經過期回傳 null，呼叫端自行決定要顯示什麼。
 */
export const formatRemaining = (ms: number): string | null => {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days} 天 ${hours} 小時`;
  if (hours > 0) return `${hours} 小時 ${mins} 分`;
  return `${mins} 分`;
};

/** 千分位，固定用 en-US 以確保格式一致 */
export const formatNumber = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
