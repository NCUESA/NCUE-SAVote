import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * filled   主要動作。每個畫面只該有一顆。
   * tonal    次要動作：淡色底、主色字（iOS 的 "tinted"）
   * outlined 次要動作：灰底、主色字（iOS 的 "bordered"）。原本是細外框，
   *          是全站唯一還在用外框的元件，改成和 iOS 一樣的灰底
   * text     最輕的動作：只有文字
   * elevated / fab 保留給既有呼叫端，外觀分別等同 tonal / filled
   */
  variant?: 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated' | 'fab';
  color?: 'primary' | 'secondary' | 'tertiary' | 'error';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

/**
 * 按鈕
 *
 * 原本是 Material 3 的寫法：ripple 波紋、tonal 色票、elevation 陰影。
 * 改為與整個系統一致的 iOS 手感：膠囊外形、按下時微縮與變淡、沒有陰影。
 *
 * 所有尺寸在觸控裝置上的最小點擊高度都是 44px。
 */
const SIZES = {
  sm: 'h-9 px-4 text-sm gap-1.5 [@media(pointer:coarse)]:min-h-11',
  md: 'h-11 px-5 text-[15px] gap-2',
  lg: 'h-[52px] px-7 text-base gap-2',
} as const;

// 每種語意色在四種變體下的樣式
const GRAY = 'bg-[var(--color-surface-container-high)] hover:bg-[var(--color-surface-container-highest)]';
const TONE = {
  primary: {
    filled: 'bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]',
    tonal: 'bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)]',
    outlined: `${GRAY} text-[var(--color-primary)]`,
    text: 'text-[var(--color-primary)] hover:bg-[var(--color-primary)]/[0.08]',
  },
  secondary: {
    filled: 'bg-[var(--color-on-surface)] text-[var(--color-surface-container-lowest)]',
    tonal: `${GRAY} text-[var(--color-on-surface)]`,
    outlined: `${GRAY} text-[var(--color-on-surface)]`,
    text: 'text-[var(--color-on-surface-variant)] hover:bg-[var(--color-on-surface)]/[0.06]',
  },
  tertiary: {
    filled: 'bg-[var(--color-tertiary)] text-[var(--color-on-tertiary)]',
    tonal: 'bg-[var(--color-tertiary-container)] text-[var(--color-on-tertiary-container)]',
    outlined: `${GRAY} text-[var(--color-tertiary)]`,
    text: 'text-[var(--color-tertiary)] hover:bg-[var(--color-tertiary)]/[0.08]',
  },
  error: {
    filled: 'bg-[var(--color-error)] text-[var(--color-on-error)]',
    tonal: 'bg-[var(--color-error-container)] text-[var(--color-on-error-container)]',
    outlined: `${GRAY} text-[var(--color-error)]`,
    text: 'text-[var(--color-error)] hover:bg-[var(--color-error)]/[0.08]',
  },
} as const;

type Variant = NonNullable<ButtonProps['variant']>;

export interface ButtonStyleOptions {
  variant?: Variant;
  color?: NonNullable<ButtonProps['color']>;
  size?: NonNullable<ButtonProps['size']>;
  disabled?: boolean;
  loading?: boolean;
}

/** 按鈕外觀。連結要長得像按鈕時用 ButtonLink，不要把 <button> 包進 <a>（無效的巢狀互動元素）。 */
export function buttonClassName({
  variant = 'filled',
  color = 'primary',
  size = 'md',
  disabled,
  loading,
}: ButtonStyleOptions = {}) {
  const resolved = variant === 'fab' ? 'filled' : variant === 'elevated' ? 'tonal' : variant;
  return cn(
    'relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-full font-semibold',
    'transition-[transform,opacity,background-color] duration-[var(--dur-micro)] ease-[var(--ease-standard)]',
    'active:scale-[0.97] active:opacity-80',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-ring-offset)]',
    'disabled:pointer-events-none',
    SIZES[size],
    // 停用的實心按鈕用灰底灰字（iOS 慣例），不是淡掉的品牌色 ——
    // 淡藍色看起來像「還能按」。處理中則保留原色，只顯示轉圈。
    disabled && !loading && resolved === 'filled'
      ? 'bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)]'
      : TONE[color][resolved],
    disabled && !loading && resolved !== 'filled' && 'opacity-40',
    loading && 'opacity-80',
    // 只有文字的按鈕水平內距收窄，但高度維持可點擊
    resolved === 'text' && 'px-3',
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'filled',
      color = 'primary',
      size = 'md',
      loading,
      icon,
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClassName({ variant, color, size, disabled, loading }), className)}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        icon && (
          <span className="flex items-center justify-center" aria-hidden="true">
            {icon}
          </span>
        )
      )}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export interface ButtonLinkProps extends Omit<LinkProps, 'color'>, Omit<ButtonStyleOptions, 'disabled' | 'loading'> {
  icon?: React.ReactNode;
}

/** 外觀是按鈕的路由連結 */
export const ButtonLink = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ className, variant, color, size, icon, children, ...props }, ref) => (
    <Link ref={ref} className={cn(buttonClassName({ variant, color, size }), className)} {...props}>
      {icon && (
        <span className="flex items-center justify-center" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </Link>
  ),
);
ButtonLink.displayName = 'ButtonLink';
