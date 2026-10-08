import React from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** 說明這個動作會造成什麼後果，而不只是「確定嗎？」 */
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** destructive 用 error 語意色；預設為一般確認 */
  tone?: 'default' | 'destructive';
  loading?: boolean;
}

/**
 * 破壞性動作的確認對話框。
 *
 * 取代散落各頁的 window.confirm()：
 *   - window.confirm 無法說明後果，只能塞一行字
 *   - 樣式由瀏覽器決定，和系統其他部分完全不一致
 *   - 在部分瀏覽器會被當成彈出視窗而被封鎖
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = '確認',
  cancelLabel = '取消',
  tone = 'default',
  loading = false,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    title={title}
    icon={
      tone === 'destructive' ? (
        <AlertTriangle className="h-8 w-8 text-[var(--color-error)]" aria-hidden="true" />
      ) : undefined
    }
    actions={
      <>
        <Button variant="text" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          color={tone === 'destructive' ? 'error' : 'primary'}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div
      className={
        tone === 'destructive'
          ? 'rounded-2xl border border-[var(--color-error)]/40 bg-[var(--color-error-container)] p-4 text-sm leading-relaxed text-[var(--color-on-error-container)]'
          : 'text-sm leading-relaxed text-[var(--color-on-surface-variant)]'
      }
    >
      {description}
    </div>
  </Dialog>
);
