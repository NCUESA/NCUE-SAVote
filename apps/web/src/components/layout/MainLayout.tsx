import React, { useCallback } from "react";
import { useNavigate, Link, Outlet } from "react-router-dom";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { Navigation, NavItem } from "../m3/Navigation";
import { ThemeToggle } from "../m3/ThemeToggle";
import {
  Shield,
  Home,
  Settings,
  LogOut,
  //BookOpen,
  LockKeyhole,
  LayoutDashboard,
  User,
  Activity,
  SlidersHorizontal,
  Coins,
  FileText
} from "lucide-react";
import { InstallPrompt } from "../InstallPrompt";
import { UserRole } from "@savote/shared-types";
import { useToastStore } from "../../stores/toastStore";
import { useLocation } from "react-router-dom";

interface MainLayoutProps {
  children?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);

  // In your component
  const location = useLocation();

  // Check if the current path is under the admin section
  const isAdminRoute = location.pathname.startsWith('/admin');

  const isAdmin =
    user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      // Use requestAnimationFrame or a very short timeout to ensure unmounting cycle is clear
      requestAnimationFrame(() => {
        navigate("/auth/login", { replace: true });
      });
    } catch (error) {
      addToast("登出時發生錯誤", "error");
    }
  }, [logout, navigate, addToast]);

  const handleNavClick = (requiredRole?: UserRole) => {
    if (requiredRole === UserRole.SUPER_ADMIN && !isSuperAdmin) {
      addToast("您無權限存取權限管理頁面", "warning");
      return true; // prevent navigation
    }
    return false;
  };

  const actualNavItems: NavItem[] = [];

  if (isAdmin && isAdminRoute) {
    actualNavItems.push({
      label: "後台總覽",
      icon: <LayoutDashboard className="w-6 h-6" strokeWidth={1.5} />,
      activeIcon: <LayoutDashboard className="w-6 h-6" strokeWidth={2.5} />,
      to: "/admin",
      end: true,
    });

    actualNavItems.push({
      label: "選舉管理",
      icon: <Settings className="w-6 h-6" strokeWidth={1.5} />,
      activeIcon: <Settings className="w-6 h-6" strokeWidth={2.5} />,
      to: "/admin/elections",
    });

    actualNavItems.push({
      label: "選舉人管理",
      icon: <User className="w-6 h-6" strokeWidth={1.5} />,
      activeIcon: <User className="w-6 h-6" strokeWidth={2.5} />,
      to: "/admin/voters",
    });

    actualNavItems.push({
      label: "開票監控",
      icon: <Activity className="w-6 h-6" strokeWidth={1.5} />,
      activeIcon: <Activity className="w-6 h-6" strokeWidth={2.5} />,
      to: "/admin/monitoring"
    });

    actualNavItems.push({
      label: '抽獎',
      icon: <Coins className="w-6 h-6" strokeWidth={1.5} />,
      activeIcon: <Coins className="w-6 h-6" strokeWidth={2.5} />,
      to: '/admin/lottery'
    });

    actualNavItems.push({
      label: "權限管理",
      icon: <LockKeyhole className="w-6 h-6" strokeWidth={1.5} />,
      activeIcon: <LockKeyhole className="w-6 h-6" strokeWidth={2.5} />,
      to: "/admin/accounts",
    });

    if (isSuperAdmin) {
      actualNavItems.push({
        label: "系統設定",
        icon: <SlidersHorizontal className="w-6 h-6" strokeWidth={1.5} />,
        activeIcon: <SlidersHorizontal className="w-6 h-6" strokeWidth={2.5} />,
        to: "/admin/settings",
      });
    }
  } else {
    actualNavItems.push({
      label: "首頁",
      icon: <Home className="w-6 h-6" strokeWidth={1.5} />,
      activeIcon: <Home className="w-6 h-6" strokeWidth={2.5} />,
      to: "/",
      end: true,
    });

    actualNavItems.push({
      label: "選舉公報",
      icon: <FileText className="w-6 h-6" strokeWidth={1.5} />,
      activeIcon: <FileText className="w-6 h-6" strokeWidth={2.5} />,
      to: "/info/bulletin",
    });
  }

  // 頂欄右側的動作一律是同一種 40px 圓形圖示鈕。原本是四種長相：
  // 使用者膠囊、主題圖示鈕、圖示＋文字的「回首頁」、紅字的「登出」。
  const iconButton =
    "focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-on-surface)]/[0.06] text-[var(--color-on-surface)] transition-[background-color,transform] duration-[var(--dur-micro)] hover:bg-[var(--color-on-surface)]/[0.1] active:scale-95";

  const initial = (user?.name || "").trim().charAt(0) || "我";
  const roleLabel =
    user?.role === UserRole.SUPER_ADMIN
      ? "超級管理員"
      : user?.role === UserRole.ADMIN
        ? "管理員"
        : "選舉人";

  const TopBar = () => (
    <header className="glass fixed inset-x-0 top-0 z-40 flex h-[calc(4rem+env(safe-area-inset-top,0px))] items-center justify-between gap-3 rounded-none border-x-0 border-t-0 pt-[env(safe-area-inset-top,0px)] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] md:h-[72px] md:pl-6 md:pr-6">
      <Link
        to={isAdmin && isAdminRoute ? "/admin" : "/"}
        className="focus-ring flex min-w-0 items-center gap-3 rounded-2xl"
      >
        <img
          src="/sa_logo.webp"
          alt=""
          width={40}
          height={40}
          className="h-9 w-9 shrink-0 object-contain md:h-10 md:w-10"
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-bold leading-tight text-[var(--color-on-surface)] md:text-base">
            國立彰化師範大學學生會
          </span>
          <span className="hidden truncate text-xs text-[var(--color-on-surface-variant)] sm:block">
            {isAdminRoute ? "選務管理後台" : "學生選舉系統"}
          </span>
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        {user && (
          <div className="mr-1 hidden items-center gap-2.5 lg:flex">
            <span className="flex flex-col items-end leading-tight">
              <span className="text-sm font-semibold text-[var(--color-on-surface)]">
                {user.name || "使用者"}
              </span>
              <span className="text-xs text-[var(--color-on-surface-variant)]">{roleLabel}</span>
            </span>
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-container)] text-sm font-bold text-[var(--color-on-primary-container)]"
            >
              {initial}
            </span>
          </div>
        )}

        <ThemeToggle className={iconButton} />

        {user?.role === UserRole.SUPER_ADMIN && (
          <button
            type="button"
            onClick={() => navigate(isAdminRoute ? "/" : "/admin")}
            aria-label={isAdminRoute ? "切換到選舉人首頁" : "切換到管理後台"}
            title={isAdminRoute ? "選舉人首頁" : "管理後台"}
            className={iconButton}
          >
            {isAdminRoute ? (
              <Home className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Shield className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={handleLogout}
          aria-label="登出"
          title="登出"
          className={iconButton}
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
    </header>
  );

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[var(--color-background)] text-[var(--color-on-surface)]">
      {/* 鍵盤使用者可直接跳到主內容，不必逐一 Tab 過整個導航 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-[var(--color-primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-[var(--color-on-primary)]"
      >
        跳至主要內容
      </a>
      <Navigation
        items={actualNavItems}
        orientation="vertical"
        label="主要導航"
        onItemClick={(to) => {
          if (to === "/admin/accounts" || to === "/admin/settings") {
            return handleNavClick(UserRole.SUPER_ADMIN);
          }
          return false;
        }}
      />
      <TopBar />

      <main
        id="main-content"
        className="relative z-10 mx-auto w-full max-w-7xl animate-fade-in overflow-x-hidden px-4 pt-[calc(4rem+env(safe-area-inset-top,0px)+1.5rem)] pb-[calc(var(--spacing-nav-bottom)+env(safe-area-inset-bottom,0px)+1.5rem)] md:px-10 md:pt-[104px] md:pb-12 md:pl-[112px]"
      >
        {children || <Outlet />}
      </main>

      <Navigation
        items={actualNavItems}
        orientation="horizontal"
        label="主要導航（行動版）"
        onItemClick={(to) => {
          if (to === "/admin/accounts" || to === "/admin/settings") {
            return handleNavClick(UserRole.SUPER_ADMIN);
          }
          return false;
        }}
      />
      <InstallPrompt />
    </div>
  );
};
