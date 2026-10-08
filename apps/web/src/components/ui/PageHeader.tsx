import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** 標題右側的動作（通常是一顆主要按鈕） */
  actions?: React.ReactNode;
  /** 標題下方的附加資訊，例如身分徽章 */
  meta?: React.ReactNode;
  /** 顯示返回按鈕：true 為瀏覽器上一頁，字串為指定路徑 */
  back?: boolean | string;
  backLabel?: string;
  className?: string;
}

/**
 * 頁首
 *
 * 全站每一頁都用這一個。原本有三種寫法：左側直條＋標題、AdminHeader 元件、
 * 以及各頁自己手寫的 h1／h2 —— 字級、間距、返回鈕位置每頁都不一樣。
 *
 * 版型參照 iOS 的 Large Title：大而粗的標題、下方一行說明、動作靠右。
 */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  back,
  backLabel = '返回',
  className,
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className={cn('flex flex-col gap-4', className)}>
      {back && (
        <button
          type="button"
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          className="focus-ring -ml-2 flex w-fit items-center gap-0.5 rounded-full py-1 pl-1 pr-3 text-[15px] font-medium text-[var(--color-primary)] transition-opacity duration-[var(--dur-micro)] hover:opacity-70"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          {backLabel}
        </button>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h1 className="type-display-small text-[var(--color-on-surface)]">{title}</h1>
          {description && (
            <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--color-on-surface-variant)]">
              {description}
            </p>
          )}
          {meta && <div className="pt-1.5">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
