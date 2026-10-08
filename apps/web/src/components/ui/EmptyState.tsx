import React from 'react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'neutral' | 'warning' | 'error';
  className?: string;
}

/** 空狀態／錯誤狀態 —— 全站統一的「這裡沒有東西可看」版面 */
export function EmptyState({ icon: Icon, title, description, action, tone = 'neutral', className }: EmptyStateProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'flex flex-col items-center gap-4 rounded-3xl bg-[var(--color-surface-container-lowest)] px-6 py-12 text-center md:py-16',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-2xl',
          tone === 'warning'
            ? 'bg-[var(--color-warning-container)] text-[var(--color-on-warning-container)]'
            : tone === 'error'
              ? 'bg-[var(--color-error-container)] text-[var(--color-on-error-container)]'
              : 'bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]',
        )}
      >
        <Icon className="h-7 w-7" />
      </span>
      <div className="max-w-md space-y-1.5">
        <h2 className="type-title-large text-[var(--color-on-surface)]">{title}</h2>
        {description && (
          <div className="text-[15px] leading-relaxed text-[var(--color-on-surface-variant)]">{description}</div>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
