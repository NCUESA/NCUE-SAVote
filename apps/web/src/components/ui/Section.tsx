import React from 'react';
import { cn } from '../../lib/utils';

export interface SectionProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** 標題列右側的動作 */
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** 內容是否包在白卡裡；清單、表格通常要，卡片格狀排列則不要 */
  card?: boolean;
  className?: string;
  bodyClassName?: string;
}

/**
 * 區塊：iOS 分組清單的「標題 + 白卡」。
 * 後台每一頁原本都自己拼 h2 + 卡片，標題大小與間距各頁不同。
 */
export function Section({ title, description, actions, children, card = true, className, bodyClassName }: SectionProps) {
  return (
    <section className={cn('space-y-3', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div className="min-w-0 space-y-0.5">
            {title && <h2 className="type-title-large text-[var(--color-on-surface)]">{title}</h2>}
            {description && (
              <p className="text-sm leading-relaxed text-[var(--color-on-surface-variant)]">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {card ? (
        <div className={cn('rounded-3xl bg-[var(--color-surface-container-lowest)] p-5 md:p-6', bodyClassName)}>
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
