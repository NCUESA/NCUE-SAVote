import React from 'react';
import { cn } from '../../lib/utils';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 必填：只有圖示的按鈕一定要有可讀的名稱 */
  'aria-label': string;
  tone?: 'neutral' | 'primary' | 'error';
  size?: 'sm' | 'md';
}

const TONE = {
  neutral: 'text-[var(--color-on-surface-variant)] hover:bg-[var(--color-on-surface)]/[0.07] hover:text-[var(--color-on-surface)]',
  primary: 'text-[var(--color-primary)] hover:bg-[var(--color-primary)]/[0.08]',
  error: 'text-[var(--color-error)] hover:bg-[var(--color-error)]/[0.08]',
} as const;

/** 只有圖示的圓形按鈕。後台表格裡原本有圓角方形、外框、填色三種寫法。 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ tone = 'neutral', size = 'md', className, type = 'button', children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'focus-ring inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-[var(--dur-micro)] active:scale-95',
        'disabled:pointer-events-none disabled:opacity-30',
        size === 'sm' ? 'h-9 w-9 [&_svg]:h-4 [&_svg]:w-4' : 'h-10 w-10 [&_svg]:h-[18px] [&_svg]:w-[18px]',
        TONE[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
IconButton.displayName = 'IconButton';
