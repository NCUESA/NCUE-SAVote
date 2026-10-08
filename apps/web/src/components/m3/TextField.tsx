import React, { useId } from 'react';
import { cn } from '../../lib/utils';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label: string;
  error?: string;
  helperText?: string;
  /** 保留給既有呼叫端；兩種外觀已統一 */
  variant?: 'outlined' | 'filled';
  endAdornment?: React.ReactNode;
  multiline?: boolean;
  rows?: number;
}

/**
 * 文字輸入框
 *
 * 標籤固定在輸入框上方、輸入框是填色的凹槽 —— 與系統其他部分同一套語言。
 * 原本是 Material 的浮動標籤：標籤平時壓在輸入框裡，聚焦才縮小上移。
 * 那種寫法在欄位一多時很難掃讀，而且 label 與 input 沒有綁定。
 */
export const TextField = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, TextFieldProps>(
  (
    { className, label, error, helperText, variant: _variant, endAdornment, multiline, rows, id, required, ...props },
    ref,
  ) => {
    const autoId = useId();
    const fieldId = id ?? `tf-${autoId}`;
    const messageId = `${fieldId}-message`;
    const hasMessage = Boolean(error || helperText);

    const inputClass = cn(
      'block w-full rounded-xl border bg-[var(--color-surface-container-high)] px-4 text-[15px] text-[var(--color-on-surface)]',
      'placeholder:text-[var(--color-on-surface-variant)]/70',
      'transition-[border-color,box-shadow] duration-[var(--dur-micro)]',
      'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40',
      error
        ? 'border-[var(--color-error)] focus:border-[var(--color-error)]'
        : 'border-transparent focus:border-[var(--color-primary)]',
      multiline ? 'min-h-24 resize-y py-3 leading-relaxed' : 'h-12',
      endAdornment && !multiline && 'pr-11',
    );

    const shared = {
      id: fieldId,
      required,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': hasMessage ? messageId : undefined,
      className: inputClass,
    };

    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label htmlFor={fieldId} className="px-1 text-sm font-semibold text-[var(--color-on-surface)]">
          {label}
          {required && (
            <span aria-hidden="true" className="ms-0.5 text-[var(--color-error)]">
              *
            </span>
          )}
        </label>

        <div className="relative">
          {multiline ? (
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              rows={rows || 3}
              {...shared}
              {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
          ) : (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              {...shared}
              {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
            />
          )}

          {endAdornment && !multiline && (
            <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)]">
              {endAdornment}
            </div>
          )}
        </div>

        {hasMessage && (
          <p
            id={messageId}
            role={error ? 'alert' : undefined}
            className={cn(
              'px-1 text-[13px] leading-snug',
              error ? 'text-[var(--color-error)]' : 'text-[var(--color-on-surface-variant)]',
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  },
);
TextField.displayName = 'TextField';
