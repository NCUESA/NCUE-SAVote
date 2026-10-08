import React from 'react';
import { useToastStore, ToastType } from '../../stores/toastStore';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

const ICON: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const ICON_COLOR: Record<ToastType, string> = {
  success: 'text-[var(--color-success)]',
  error: 'text-[var(--color-error)]',
  info: 'text-[var(--color-info)]',
  warning: 'text-[var(--color-warning)]',
};

const LABEL: Record<ToastType, string> = {
  success: '成功',
  error: '錯誤',
  info: '提示',
  warning: '警告',
};

/**
 * 通知
 *
 * 與系統其他浮起元素同一套外觀：實心卡片、22px 圓角、浮起陰影。
 * 狀態靠「圖示形狀＋語意色＋隱藏的文字標籤」三者一起表達。
 */
export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed z-[60] flex flex-col gap-2',
        'inset-x-3 top-[calc(4rem+env(safe-area-inset-top,0px)+0.5rem)]',
        'sm:inset-x-auto sm:right-6 sm:top-[88px] sm:w-full sm:max-w-sm',
      )}
    >
      {toasts.map((toast) => {
        const Icon = ICON[toast.type];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex animate-slide-in-right items-start gap-3 rounded-3xl bg-[var(--color-surface-container-lowest)] py-3 pl-4 pr-2 elevation-4"
          >
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', ICON_COLOR[toast.type])} aria-hidden="true" />
            <p className="flex-1 select-text py-0.5 text-[15px] font-medium leading-snug text-[var(--color-on-surface)]">
              <span className="sr-only">{LABEL[toast.type]}：</span>
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label={`關閉${LABEL[toast.type]}通知`}
              className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-on-surface-variant)] transition-colors duration-[var(--dur-micro)] hover:bg-[var(--color-on-surface)]/[0.06]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
