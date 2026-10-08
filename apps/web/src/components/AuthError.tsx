import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from './m3/Card';
import { Button } from './m3/Button';
import { AlertCircle, ArrowLeft, Home } from 'lucide-react';

/**
 * Authentication Error Page
 * Displays error message from SAML SSO or other auth failures
 */
export function AuthError() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const errorMessage = searchParams.get('message') || '登入過程中發生錯誤。';

  return (
    <div className="flex justify-center items-center min-h-screen p-4 bg-[var(--color-background)]">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-2xl bg-[var(--color-error-container)] mb-5">
          <AlertCircle className="h-7 w-7 text-[var(--color-on-error-container)]" />
        </div>

        <h2 className="type-headline-small mb-2 text-[var(--color-on-surface)]">
          登入失敗
        </h2>

        <p className="text-[var(--color-on-surface-variant)] mb-8">
          {errorMessage}
        </p>

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => navigate('/auth/login')}
            className="w-full"
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            再試一次
          </Button>

          <Button
            variant="outlined"
            onClick={() => navigate('/')}
            className="w-full"
            icon={<Home className="w-4 h-4" />}
          >
            返回首頁
          </Button>
        </div>
      </Card>
    </div>
  );
}
