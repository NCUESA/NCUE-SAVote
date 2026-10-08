import React from 'react';
import { CircleDot, Timer, Check, AlertCircle, Info, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'tertiary';

const TONE: Record<StatusTone, string> = {
  success: 'bg-[var(--color-success-container)] text-[var(--color-on-success-container)]',
  warning: 'bg-[var(--color-warning-container)] text-[var(--color-on-warning-container)]',
  error: 'bg-[var(--color-error-container)] text-[var(--color-on-error-container)]',
  info: 'bg-[var(--color-info-container)] text-[var(--color-on-info-container)]',
  tertiary: 'bg-[var(--color-tertiary-container)] text-[var(--color-on-tertiary-container)]',
  neutral: 'bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)]',
};

/** 每種語意都有自己的圖示形狀，色盲使用者不看顏色也能分辨（WCAG 1.4.1） */
const DEFAULT_ICON: Record<StatusTone, React.ElementType> = {
  success: CircleDot,
  warning: Timer,
  error: AlertCircle,
  info: Info,
  tertiary: Info,
  neutral: Check,
};

export interface StatusBadgeProps {
  tone: StatusTone;
  children: React.ReactNode;
  /** 自訂圖示；傳 null 表示不顯示圖示 */
  icon?: React.ElementType | null;
  /** 「進行中」用：圖示外加一圈脈動 */
  pulse?: boolean;
  className?: string;
}

/**
 * 狀態徽章 —— 全站唯一一種寫法。
 * 原本每一頁各自用不同的色票、大小、圓角與字重手寫狀態標籤。
 */
export function StatusBadge({ tone, children, icon, pulse, className }: StatusBadgeProps) {
  const Icon = icon === null ? null : (icon ?? DEFAULT_ICON[tone] ?? Minus);
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none',
        TONE[tone],
        className,
      )}
    >
      {Icon && (
        <span className="relative flex h-3.5 w-3.5 items-center justify-center" aria-hidden="true">
          {pulse && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-40" />
          )}
          <Icon className="relative h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      )}
      {children}
    </span>
  );
}
