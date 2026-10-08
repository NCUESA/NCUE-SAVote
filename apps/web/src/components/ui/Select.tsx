import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  /** 小尺寸：用在表格列裡 */
  size?: 'sm' | 'md';
  hint?: string;
}

/** 下拉選單：原生 select（手機上會叫出系統選擇器），外觀與 TextField 一致 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, size = 'md', hint, id, className, children, ...props }, ref) => {
    const autoId = useId();
    const selectId = id ?? `sel-${autoId}`;
    return (
      <div className={cn('space-y-1.5', className)}>
        {label && (
          <label htmlFor={selectId} className="block text-sm font-semibold text-[var(--color-on-surface)]">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'block w-full cursor-pointer appearance-none rounded-xl bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 disabled:cursor-not-allowed disabled:opacity-50',
              size === 'sm' ? 'h-9 pl-3 pr-8 text-sm' : 'h-12 pl-4 pr-10 text-[15px]',
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className={cn(
              'pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)]',
              size === 'sm' ? 'right-2.5 h-4 w-4' : 'right-3.5 h-[18px] w-[18px]',
            )}
            aria-hidden="true"
          />
        </div>
        {hint && <p className="text-xs leading-relaxed text-[var(--color-on-surface-variant)]">{hint}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';
