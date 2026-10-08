import React from 'react';
import { cn } from '../../lib/utils';

export type IconTileTone = 'primary' | 'success' | 'warning' | 'error' | 'tertiary' | 'neutral';

const TONE: Record<IconTileTone, string> = {
  primary: 'bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)]',
  success: 'bg-[var(--color-success-container)] text-[var(--color-on-success-container)]',
  warning: 'bg-[var(--color-warning-container)] text-[var(--color-on-warning-container)]',
  error: 'bg-[var(--color-error-container)] text-[var(--color-on-error-container)]',
  tertiary: 'bg-[var(--color-tertiary-container)] text-[var(--color-on-tertiary-container)]',
  neutral: 'bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]',
};

const SIZE = {
  sm: { box: 'h-9 w-9 rounded-xl', icon: 'h-[18px] w-[18px]' },
  md: { box: 'h-11 w-11 rounded-2xl', icon: 'h-[22px] w-[22px]' },
  lg: { box: 'h-14 w-14 rounded-2xl', icon: 'h-7 w-7' },
} as const;

export interface IconTileProps {
  icon: React.ElementType;
  tone?: IconTileTone;
  size?: keyof typeof SIZE;
  className?: string;
}

/**
 * 圖示磚：語意色底的圓角方塊，iOS 設定 App 的那種。
 * 原本同一個概念在各頁有圓形、方形、漸層、不同尺寸的寫法。
 */
export function IconTile({ icon: Icon, tone = 'primary', size = 'md', className }: IconTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center', SIZE[size].box, TONE[tone], className)}
    >
      <Icon className={SIZE[size].icon} />
    </span>
  );
}
