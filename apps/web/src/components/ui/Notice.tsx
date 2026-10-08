import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error' | 'neutral';

const TONE: Record<NoticeTone, string> = {
  info: 'bg-[var(--color-info-container)] text-[var(--color-on-info-container)]',
  success: 'bg-[var(--color-success-container)] text-[var(--color-on-success-container)]',
  warning: 'bg-[var(--color-warning-container)] text-[var(--color-on-warning-container)]',
  error: 'bg-[var(--color-error-container)] text-[var(--color-on-error-container)]',
  neutral: 'bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]',
};

const DEFAULT_ICON: Record<NoticeTone, React.ElementType> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  neutral: Info,
};

export interface NoticeProps {
  tone?: NoticeTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** 自訂圖示；傳 null 表示不顯示 */
  icon?: React.ElementType | null;
  /** 右側或下方的動作 */
  action?: React.ReactNode;
  className?: string;
}

/**
 * 提示框 —— 全站唯一一種寫法。
 *
 * 原本每一頁各自手寫：有的有外框、有的半透明、有的用 border-l-4，
 * 字級從 10px 到 15px 都有。統一成「語意色底＋圖示＋標題＋內文」。
 * 錯誤與警告會被螢幕閱讀器主動朗讀。
 */
export function Notice({ tone = 'info', title, children, icon, action, className }: NoticeProps) {
  const Icon = icon === null ? null : (icon ?? DEFAULT_ICON[tone]);
  return (
    <div
      role={tone === 'error' ? 'alert' : tone === 'warning' ? 'status' : undefined}
      className={cn('flex items-start gap-3 rounded-2xl p-4', TONE[tone], className)}
    >
      {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="text-[15px] font-semibold leading-snug">{title}</p>}
        {children && <div className="text-sm leading-relaxed">{children}</div>}
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  );
}
