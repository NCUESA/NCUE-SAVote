import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNullifierSecret } from '../hooks/useNullifierSecret';
import { Button } from '../../../components/m3/Button';
import { Loader2, ShieldCheck, Eye, EyeOff, Copy, Download, CheckCircle2, AlertTriangle, Key } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDateTime } from '../../../lib/datetime';

export const NullifierSetup = () => {
  const { secret, generateNewSecret, isReady, validationError } = useNullifierSecret();
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!secret && isReady) {
      generateNewSecret().catch(() => {
        // Best effort
      });
    }
  }, [secret, generateNewSecret, isReady]);

  const handleCopySecret = async () => {
    if (secret) {
      try {
        await navigator.clipboard.writeText(secret);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleDownloadSecret = () => {
    if (secret) {
      const blob = new Blob([`投票系統 匿名金鑰備份\n產生時間: ${formatDateTime(new Date())}\n\n金鑰:\n${secret}\n\n警告:\n此金鑰用於匿名投票。請務必妥善保存。\n若遺失，將無法找回或重新產生。\n請勿與他人分享此金鑰。`], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voting-secret-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadComplete(true);
    }
  };

  const handleContinue = () => {
    if (confirmed) {
      navigate('/', { replace: true });
    }
  };

  if (!isReady) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-[var(--color-surface-variant)] rounded w-3/4 mx-auto" />
        <div className="h-24 bg-[var(--color-surface-variant)] rounded" />
        <div className="h-12 bg-[var(--color-surface-variant)] rounded" />
      </div>
    );
  }

  if (!secret) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-10 w-10 mx-auto mb-4 animate-spin text-[var(--color-primary)]" />
        <p className="text-[var(--color-on-surface-variant)] font-medium">正在產生匿名金鑰...</p>
        {validationError && (
          <p className="text-[var(--color-error)] text-sm mt-2">
            {validationError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Icon */}
      <div className="text-center animate-scale-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[var(--color-primary-container)] to-[var(--color-secondary-container)] mb-6">
          <ShieldCheck className="w-10 h-10 text-[var(--color-on-primary-container)]" />
        </div>
        <h3 className="text-2xl font-bold text-[var(--color-on-surface)] mb-2">
          金鑰已產生
        </h3>
        <p className="text-[var(--color-on-surface-variant)] max-w-sm mx-auto">
          您的金鑰已就緒，請務必妥善備份。
        </p>
      </div>

      {/* Secret Display Card */}
      <div className="bg-[var(--color-surface-container)] rounded-2xl border border-[var(--color-outline-variant)] overflow-hidden animate-fade-in-up">
        {/* Card Header */}
        <div className="px-4 py-3 bg-[var(--color-surface-container-high)] border-b border-[var(--color-outline-variant)] flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-on-surface)]">
                <Key className="w-4 h-4 text-[var(--color-primary)]" />
                您的匿名金鑰
            </div>
            <button
                onClick={() => setShowSecret(!showSecret)}
                aria-pressed={showSecret}
                aria-label={showSecret ? '隱藏投票金鑰' : '顯示投票金鑰'}
                className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--color-surface-variant)]/50 transition-colors"
            >
                {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showSecret ? '隱藏' : '顯示'}
            </button>
        </div>

        {/* Code Block */}
        <div className="p-6 relative bg-[var(--color-surface)]">
            <div className={clsx(
                "break-all rounded-xl p-4 font-mono text-sm leading-relaxed transition-[filter,color] duration-[var(--dur-control)]",
                showSecret 
                    ? "bg-[var(--color-surface-variant)]/30 text-[var(--color-on-surface)]" 
                    : "bg-[var(--color-surface-variant)]/10 text-transparent select-none blur-sm"
            )}>
                {secret}
            </div>
            
            {!showSecret && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="bg-[var(--color-inverse-surface)] text-[var(--color-inverse-on-surface)] px-4 py-2 rounded-full text-xs font-medium">
                         點擊顯示以查看金鑰
                    </span>
                </div>
            )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 divide-x divide-[var(--color-outline-variant)] border-t border-[var(--color-outline-variant)] bg-[var(--color-surface-container-low)]">
            <button
                onClick={handleCopySecret}
                disabled={!showSecret}
                className="flex items-center justify-center gap-2 py-4 text-sm font-medium text-[var(--color-on-surface)] hover:bg-[var(--color-surface-variant)]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {copied ? <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" /> : <Copy className="w-4 h-4" />}
                {copied ? '已複製' : '複製'}
            </button>
            <button
                onClick={handleDownloadSecret}
                className="flex items-center justify-center gap-2 py-4 text-sm font-medium text-[var(--color-on-surface)] hover:bg-[var(--color-surface-variant)]/50 transition-colors"
            >
                {downloadComplete ? <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" /> : <Download className="w-4 h-4" />}
                {downloadComplete ? '已下載' : '下載'}
            </button>
        </div>
      </div>

      {/* Warning */}
      <div className="flex gap-4 p-4 rounded-xl bg-[var(--color-warning-container)]/60 text-[var(--color-on-warning-container)] border border-[var(--color-warning)]/30 animate-fade-in delay-100">
        <AlertTriangle className="h-6 w-6 flex-shrink-0" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold">重要安全警告</h3>
          <p className="text-xs opacity-90 leading-relaxed">
            此金鑰僅暫存於您的瀏覽器中。若遺失，將無法透過任何方式找回。
          </p>
        </div>
      </div>

      {/* Confirmation */}
      <label
        htmlFor="nullifier-confirm"
        className="flex cursor-pointer items-start rounded-xl border-2 border-transparent p-4 transition-colors duration-[var(--dur-micro)] hover:border-[var(--color-outline-variant)]"
      >
        <div className="flex items-center h-6">
            <input
                id="nullifier-confirm"
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="w-5 h-5 rounded border-[var(--color-outline-variant)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
        </div>
        <div className="ml-3">
            <span className="block text-sm font-medium text-[var(--color-on-surface)]">
                我已完成金鑰備份，並瞭解遺失後無法找回。
            </span>
        </div>
      </label>

      {/* Continue Button */}
      <Button
        onClick={handleContinue}
        disabled={!confirmed}
        className="w-full h-12 text-base transition-shadow"
        variant="filled"
        icon={<CheckCircle2 className="w-5 h-5" />}
      >
        進入系統
      </Button>
    </div>
  );
};
