import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * elevated / filled：卡片（白卡或深色模式的 #1c1c1e 卡）
   * outlined：同上，再加一圈細框，用於需要和背景區隔得更明確的地方
   */
  variant?: 'elevated' | 'filled' | 'outlined';
  /** 可點擊的卡片：hover 時微微浮起，並有鍵盤焦點樣式 */
  interactive?: boolean;
}

/**
 * 卡片
 *
 * 層次靠「卡片與背景的明度差」表達，不靠陰影 —— 淺色是灰底白卡，
 * 深色是純黑底上的 #1c1c1e 卡。原本 elevated 會加 Material 的陰影，
 * filled 則是另一種灰，三種變體長得像三個不同的系統。
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'elevated', interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'overflow-hidden rounded-3xl bg-[var(--color-surface-container-lowest)] text-[var(--color-on-surface)]',
        variant === 'outlined' && 'border border-[var(--color-outline-variant)]',
        interactive &&
          cn(
            'cursor-pointer outline-none',
            'transition-[transform,box-shadow] duration-[var(--dur-panel)] ease-[var(--ease-standard)]',
            'hover:-translate-y-0.5 hover:elevation-3 active:scale-[0.99]',
            'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-ring-offset)]',
          ),
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';
