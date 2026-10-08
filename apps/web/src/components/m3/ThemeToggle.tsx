import { useThemeStore } from '../../stores/themeStore';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '../../lib/utils';

const NEXT = { light: 'dark', dark: 'system', system: 'light' } as const;
const LABEL = { light: '淺色', dark: '深色', system: '跟隨系統' } as const;

/**
 * 主題切換：淺色 → 深色 → 跟隨系統，循環。
 * 原本只有 title，沒有 aria-label，螢幕閱讀器只會讀出「按鈕」。
 */
export const ThemeToggle = ({ className }: { className?: string }) => {
  const { mode, setMode } = useThemeStore();
  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={() => setMode(NEXT[mode])}
      aria-label={`主題：${LABEL[mode]}，點擊切換為${LABEL[NEXT[mode]]}`}
      title={`主題：${LABEL[mode]}`}
      className={cn(
        'focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-on-surface)]',
        'transition-[background-color,transform] duration-[var(--dur-micro)] hover:bg-[var(--color-on-surface)]/[0.08] active:scale-95',
        className,
      )}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </button>
  );
};
