import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  /** 回傳 toast id；durationMs 省略時 error 為 8 秒、其餘 4 秒 */
  addToast: (message: string, type?: ToastType, durationMs?: number) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

/**
 * 原本的兩個問題：
 *
 * 1. id 用 Math.random().toString(36).substring(2, 9) 產生。短時間內連續
 *    跳出多則通知時有機會撞號，React 的 key 一重複，關閉其中一則會連帶
 *    關掉另一則。改用單調遞增的序號，不可能撞。
 *
 * 2. 自動關閉的 setTimeout 沒有被保存，removeToast 手動關閉後計時器仍在跑，
 *    4 秒後再執行一次 filter。雖然結果無害，但如果期間剛好有新通知用到
 *    同一個 id（見問題 1）就會被誤刪。現在手動關閉會一併清掉計時器。
 */
let seq = 0;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const clearTimer = (id: string) => {
  const t = timers.get(id);
  if (t !== undefined) {
    clearTimeout(t);
    timers.delete(id);
  }
};

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (message, type = 'info', durationMs) => {
    seq += 1;
    const id = `toast-${seq}`;

    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));

    // 錯誤訊息通常需要被讀完、甚至被複製下來回報，給它更長的時間
    const ttl = durationMs ?? (type === 'error' ? 8000 : 4000);
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        get().removeToast(id);
      }, ttl),
    );

    return id;
  },

  removeToast: (id) => {
    clearTimer(id);
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  clearToasts: () => {
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    set({ toasts: [] });
  },
}));
