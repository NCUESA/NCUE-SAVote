import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
// 全站只有一個 auth store。原本這裡用的是 stores/auth.store.ts，
// 而 useAuth / auth.api 用的是 features/auth/stores/authStore.ts —— 兩個獨立的
// zustand store 卻 persist 到同一個 localStorage key 'auth-storage'。
// 後果：MainLayout 呼叫登出清掉的是另一個 store，這裡的記憶體狀態不會更新，
// 使用者在不重新整理的情況下仍然可以停留在受保護頁面。
import { useAuthStore } from '../features/auth/stores/authStore';
import { UserRole } from '@savote/shared-types';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

/** 未登入導向登入頁；角色不符導向權限不足頁 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isAuthenticated) {
    // 記住原本想去的位置，登入後可以直接回去
    try {
      sessionStorage.setItem('savote_intended_path', location.pathname + location.search);
    } catch {
      // 無痕模式或封鎖儲存時忽略即可，不該因此擋下導向
    }
    return <Navigate to="/auth/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role as UserRole)) {
    return (
      <Navigate
        to={`/auth/unauthorized?message=${encodeURIComponent('您的帳號沒有存取這個頁面的權限。')}`}
        replace
      />
    );
  }

  return <>{children}</>;
}
