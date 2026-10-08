import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** 設為 true 時，點擊背景與 Esc 不會關閉（用於必須做出選擇的流程） */
  dismissible?: boolean;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  actions,
  className,
  dismissible = true,
}) => {
  const [visible, setVisible] = useState(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (open) {
      setVisible(true);
      return;
    }
    const timer = setTimeout(() => setVisible(false), 200);
    return () => clearTimeout(timer);
  }, [open]);

  // 背景捲動鎖定：原本開啟對話框時底層頁面仍可捲動，
  // 在手機上會造成「對話框浮在亂跑的內容上」的錯亂感。
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    // 補上捲軸寬度，避免鎖定瞬間版面橫向跳動
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  // 焦點管理：開啟時把焦點移入對話框，關閉時還原到原本的觸發元素
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const node = panelRef.current;
    if (!node) return;
    const first = node.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node).focus({ preventScroll: true });
    return () => {
      previouslyFocused.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  // Esc 關閉 + Tab 焦點陷阱：原本可以用 Tab 跳到對話框背後的元素
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const node = panelRef.current;
      if (!node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    },
    [dismissible, onClose],
  );

  if (!visible) return null;

  return createPortal(
    // z-[70]：原本是 z-50，與底部導航列（z-50）同級、又低於 InstallPrompt（z-100），
    // 導致安裝提示橫幅會蓋在對話框上面。
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        onClick={dismissible ? onClose : undefined}
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-[var(--dur-control)]",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          // 實心表面：玻璃只留給頂欄與導航列。對話框承載的是要讀完、
          // 要做決定的內容，透出背後的頁面只會干擾閱讀。
          "relative flex w-full flex-col bg-[var(--color-surface-container-lowest)] text-[var(--color-on-surface)] elevation-5",
          "outline-none transition-[transform,opacity] duration-[var(--dur-panel)] ease-[var(--ease-standard)]",
          // 手機改為底部抽屜（bottom sheet）：單手可達、符合行動慣例；
          // 桌機維持置中卡片。原本在手機上是置中小卡，內容一多就被壓縮。
          "max-h-[92dvh] max-w-md rounded-t-3xl pb-safe sm:max-h-[90dvh] sm:rounded-3xl",
          open
            ? "translate-y-0 opacity-100 sm:scale-100"
            : "translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95",
          className,
        )}
      >
        {/* 抽屜把手：給使用者「可以往下滑關閉」的視覺暗示 */}
        <div aria-hidden="true" className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-[var(--color-on-surface-variant)]/30 sm:hidden" />

        <div className="shrink-0 px-6 pt-5 sm:px-6 sm:pt-6">
          {icon && (
            <div className="mb-3 flex justify-center text-[var(--color-secondary)]">{icon}</div>
          )}
          {title && (
            <h2
              id={titleId}
              className="type-headline-small text-center text-[var(--color-on-surface)] sm:text-left"
            >
              {title}
            </h2>
          )}
          {description && (
            <p
              id={descId}
              className="mt-2 text-center text-sm leading-relaxed text-[var(--color-on-surface-variant)] sm:text-left sm:text-base"
            >
              {description}
            </p>
          )}
        </div>

        {children && (
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
            {children}
          </div>
        )}

        <div
          className={cn(
            "flex shrink-0 flex-col-reverse gap-2 px-6 pb-5 pt-2 sm:flex-row sm:justify-end sm:pb-6",
            "[&>button]:w-full sm:[&>button]:w-auto",
            !children && "pt-4",
          )}
        >
          {actions ?? (
            <Button variant="text" onClick={onClose}>
              關閉
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
