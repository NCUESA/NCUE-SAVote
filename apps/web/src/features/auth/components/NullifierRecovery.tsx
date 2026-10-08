import { FormEvent, useState } from 'react';
import { useNullifierSecret } from '../hooks/useNullifierSecret';
import { Button } from '../../../components/m3/Button';
import { TextField } from '../../../components/m3/TextField';
import { KeyRound, ClipboardPaste, Upload, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface NullifierRecoveryProps {
  onSuccess: () => void;
  subtitle?: string;
}

export const NullifierRecovery = ({ onSuccess, subtitle }: NullifierRecoveryProps) => {
  const { restoreSecret, validationError } = useNullifierSecret();
  const [secretInput, setSecretInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const ERROR_MESSAGES: Record<string, string> = {
    SECRET_MISMATCH: '金鑰不相符。請確認您使用的是此帳號對應的正確金鑰。',
    INVALID_FORMAT: '格式無效。金鑰必須是 64 個字元的 16 進位字串。',
    UNKNOWN_ERROR: '發生未知錯誤。',
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setSecretInput(text.trim());
      setError(null);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      setError('無法讀取剪貼簿。請手動貼上。');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const match = text.match(/([a-f0-9]{64})/i); 
        if (match && match[1]) {
          setSecretInput(match[1]);
          setError(null);
        } else {
          setError('在檔案中找不到有效的金鑰。');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!secretInput.trim()) {
      setError('請輸入您的金鑰。');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await restoreSecret(secretInput.trim());

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 400);
    } else {
      const messageKey = result.message ?? 'UNKNOWN_ERROR';
      setError(ERROR_MESSAGES[messageKey] || ERROR_MESSAGES.UNKNOWN_ERROR);
    }

    setIsSubmitting(false);
  };

  const derivedError = error || (validationError ? ERROR_MESSAGES[validationError] || validationError : null);

  const isValidFormat = secretInput.length === 64 && /^[0-9a-fA-F]{64}$/.test(secretInput);

  return (
    <div className="space-y-6" data-testid="nullifier-recovery">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-secondary-container)] mb-4 animate-scale-in">
          <KeyRound className="w-8 h-8 text-[var(--color-on-secondary-container)]" />
        </div>
        <h3 className="text-xl font-bold text-[var(--color-on-surface)] mb-2">
          恢復匿名金鑰
        </h3>
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          {subtitle || '請輸入您的 64 位元金鑰以在此裝置上恢復存取權限。'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="relative">
          <TextField
            label="匿名金鑰 (64位元)"
            type={showSecret ? 'text' : 'password'}
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            placeholder="例如：1a2b3c..."
            className="font-mono text-sm"
            error={derivedError || undefined}
          />
          
          <div className="absolute right-2 top-2 flex items-center gap-1">
             <Button
                type="button"
                variant="text"
                className="h-8 w-8 p-0 min-w-0"
                onClick={handlePaste}
                aria-label="從剪貼簿貼上金鑰"
                title="貼上"
             >
                 <ClipboardPaste className="w-4 h-4" />
             </Button>
             
             <div className="relative">
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  title="上傳備份檔案"
                />
                <Button
                    type="button"
                    variant="text"
                    className="h-8 w-8 p-0 min-w-0 pointer-events-none"
                >
                    <Upload className="w-4 h-4" />
                </Button>
             </div>

             <Button
                type="button"
                variant="text"
                className="h-8 w-8 p-0 min-w-0"
                onClick={() => setShowSecret(!showSecret)}
                aria-pressed={showSecret}
                aria-label={showSecret ? '隱藏金鑰內容' : '顯示金鑰內容'}
             >
                 {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
             </Button>
          </div>

          {/* Validation Hint */}
          {secretInput && !derivedError && (
            <div className={`mt-1 flex items-center gap-1 text-xs ${isValidFormat ? 'text-[var(--color-primary)]' : 'text-[var(--color-error)]'}`}>
               {isValidFormat ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
               {isValidFormat 
                 ? '格式正確' 
                 : `長度：${secretInput.length}/64`
               }
            </div>
          )}
        </div>

        {success && (
          <div className="p-4 rounded-lg bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] flex items-center gap-3 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">金鑰驗證成功。正在重新導向...</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting || !isValidFormat}
          loading={isSubmitting}
          className="w-full"
          icon={<KeyRound className="w-4 h-4" />}
        >
          確認並恢復
        </Button>
      </form>
    </div>
  );
};
