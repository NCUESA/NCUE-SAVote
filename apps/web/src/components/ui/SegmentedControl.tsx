import { cn } from '../../lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

/** iOS 的分段控制：灰底凹槽裡，選中的那段是浮起的白色膠囊 */
export function SegmentedControl<T extends string>({ options, value, onChange, label, className }: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid gap-1 rounded-xl bg-[var(--color-surface-container-high)] p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'focus-ring min-h-9 rounded-[9px] px-2 py-1.5 text-sm font-semibold leading-tight transition-[background-color,color,box-shadow] duration-[var(--dur-control)]',
              selected
                ? 'seg-active text-[var(--color-on-surface)]'
                : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
