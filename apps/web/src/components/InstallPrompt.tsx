import { useEffect, useState } from 'react';
import { X, Share, Plus } from 'lucide-react';
import { Button } from './m3/Button';

const DISMISS_KEY = 'savote_install_dismissed_at';
const DISMISS_DAYS = 30;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const recentlyDismissed = () => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
};

/**
 * PWA 安裝提示
 *
 * 原本的問題：
 *   - 只要偵測到 iPhone／iPad 就在 2 秒後彈出一張大卡片，桌機 Safari、
 *     已經安裝過的使用者、剛關掉的人每次載入都會再看到一次
 *   - 卡片蓋在頁面內容正中間，還擋住了後台的功能卡片
 *
 * 現在：
 *   - 只在「iOS Safari 且尚未安裝」或「瀏覽器真的發出 beforeinstallprompt」時出現
 *   - 關掉之後 30 天內不再出現
 *   - 是一條貼在導航列上方的精簡橫幅，不遮擋主要內容
 */
export const InstallPrompt = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (recentlyDismissed()) return;

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const ua = window.navigator.userAgent;
    // iPadOS 13+ 會偽裝成 Mac，要靠觸控點數判斷
    const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

    if (iOS && isSafari) {
      setIsIOS(true);
      const t = setTimeout(() => setVisible(true), 4000);
      return () => clearTimeout(t);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // 封鎖儲存時就只關這一次
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="安裝應用程式"
      className="fixed inset-x-3 z-[55] mx-auto flex max-w-md animate-slide-up items-center gap-3 rounded-3xl bg-[var(--color-surface-container-lowest)] p-3 pl-4 elevation-4 bottom-[calc(var(--spacing-nav-bottom)+env(safe-area-inset-bottom,0px)+0.5rem)] md:bottom-6 md:right-6 md:left-auto md:mx-0"
    >
      <img src="/apple-touch-icon.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl" />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--color-on-surface)]">加入主畫面</p>
        <p className="flex flex-wrap items-center gap-x-1 text-[13px] leading-snug text-[var(--color-on-surface-variant)]">
          {isIOS ? (
            <>
              點選
              <Share className="inline h-3.5 w-3.5" aria-label="分享" />
              再選
              <span className="inline-flex items-center gap-0.5 font-medium text-[var(--color-on-surface)]">
                <Plus className="h-3 w-3" aria-hidden="true" />
                加入主畫面
              </span>
            </>
          ) : (
            '像 App 一樣從桌面直接開啟'
          )}
        </p>
      </div>

      {!isIOS && deferred && (
        <Button size="sm" onClick={install}>
          安裝
        </Button>
      )}

      <button
        type="button"
        onClick={dismiss}
        aria-label="關閉安裝提示"
        className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-on-surface-variant)] transition-colors duration-[var(--dur-micro)] hover:bg-[var(--color-on-surface)]/[0.06]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};
