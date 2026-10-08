import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SearchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  /** 給螢幕閱讀器的名稱；預設用 placeholder */
  label?: string;
}

/** 搜尋框 —— iOS 的灰底膠囊。原本各頁的搜尋框高度 44～64px、有的有外框、有的有陰影。 */
export function SearchField({ value, onChange, label, placeholder = '搜尋', className, ...props }: SearchFieldProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--color-on-surface-variant)]"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={label ?? placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl bg-[var(--color-surface-container-high)] pl-10 pr-10 text-[15px] text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="清除搜尋"
          className="focus-ring absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--color-on-surface-variant)] hover:bg-[var(--color-on-surface)]/[0.08]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
