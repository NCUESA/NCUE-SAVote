import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
// 與 ProtectedRoute / useAuth 共用同一個 store（原本這裡用的是另一個重複的 store）
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../services/auth.api';
import { storage } from '../../../lib/localStorage';
import { Card } from '../../../components/m3/Card';
import { Button } from '../../../components/m3/Button';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';

export const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);
  const setNullifierSecretStatus = useAuthStore(state => state.setNullifierSecretStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isProcessing) return;

    const handleCallback = async () => {
      setIsProcessing(true);

      const accessToken = searchParams.get('accessToken');
      const refreshToken = searchParams.get('refreshToken');

      // 後端是用 query string 把 token 帶回來的，等於 access + refresh token
      // 會留在網址列、瀏覽紀錄、Referer 標頭與 nginx / Cloudflare 的存取日誌裡。
      // 取出後立刻從網址抹掉，縮小暴露面（根本解法仍須改後端，見安全性報告）。
      if (accessToken || refreshToken) {
        window.history.replaceState(null, '', '/auth/callback');
      }

      if (accessToken && refreshToken) {
        try {
          await storage.setAccessToken(accessToken);
          await storage.setRefreshToken(refreshToken);

          const user = await authApi.getCurrentUser();
          setAuth(accessToken, refreshToken, user);

          // Handle Redirect
          const intent = sessionStorage.getItem('loginIntent');
          sessionStorage.removeItem('loginIntent');

          // A: redirect to home
          if (intent === 'home') {
            setNullifierSecretStatus(true);
            navigate('/', { replace: true });
            return;
          }

          // B: admin Login and check permission
          if (intent === 'admin' && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
            navigate('/admin', { replace: true });
            return;
          }

          // C: url direct link
          if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
            navigate('/admin', { replace: true });
          } else {
            setNullifierSecretStatus(true);
            navigate('/', { replace: true });
          }
          return;

        } catch (error) {
          console.error('Callback error:', error);
          setErrorMessage('登入驗證失敗，請稍後再試。');
        }
      } else {
        setErrorMessage('缺少必要的參數，請重新登入。');
      }
    };

    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (errorMessage) {
    return (
      <div className="flex justify-center items-center min-h-screen px-4 bg-[var(--color-background)]">
        <div className="w-full max-w-md">
          <Card className="p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-[var(--color-error-container)] mb-4">
              <AlertTriangle className="h-6 w-6 text-[var(--color-on-error-container)]" />
            </div>
            <p className="text-[var(--color-error)] font-medium mb-6">{errorMessage}</p>
            <Button
              onClick={() => navigate('/auth/login')}
              className="w-full"
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              返回登入
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen px-4 bg-[var(--color-background)]">
      <div className="text-center">
        <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-[var(--color-primary)]" />
        <h2 className="text-2xl font-bold text-[var(--color-on-background)] mb-2">正在驗證登入身分...</h2>
        <p className="text-[var(--color-on-surface-variant)]">請稍候</p>
      </div>
    </div>
  );
};
