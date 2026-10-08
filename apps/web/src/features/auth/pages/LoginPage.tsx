import { useState } from "react";
import { ThemeToggle } from "../../../components/m3/ThemeToggle";
import { GraduationCap, ArrowRight, FileText, ShieldCheck, LockKeyhole } from "lucide-react";
import { UserGuideContent } from "../../info/components/UserGuideContent";
import { Dialog } from "../../../components/m3/Dialog";
import { Button, ButtonLink } from "../../../components/m3/Button";

export const LoginPage = () => {
  const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  // 轉址到 SSO 需要一兩秒，沒有狀態的話使用者會以為沒反應而重複點擊
  const [redirecting, setRedirecting] = useState<"voter" | "admin" | null>(null);

  const handleAdminLogin = () => {
    setRedirecting("admin");
    sessionStorage.setItem("loginIntent", "admin");
    window.location.href = `${API_URL}/auth/admin/login`;
  };

  const handleSSOConfirm = () => {
    setRedirecting("voter");
    sessionStorage.setItem("loginIntent", "home");
    window.location.href = `${API_URL}/auth/login`;
  };

  return (
    <div className="relative flex min-h-dvh flex-col bg-[var(--color-background)]">
      <div className="absolute right-[max(0.75rem,env(safe-area-inset-right,0px))] top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-20 md:right-6 md:top-6">
        <ThemeToggle className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container-highest)]" />
      </div>

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-8 pt-[calc(4.5rem+env(safe-area-inset-top,0px))] md:py-16">
        <div className="w-full max-w-[400px] animate-slide-up">
          {/* 品牌區 */}
          <div className="mb-8 flex flex-col items-center text-center">
            <span className="mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-[var(--color-surface-container-lowest)] md:h-28 md:w-28">
              <img
                src="/sa_logo.webp"
                alt=""
                width={80}
                height={80}
                className="h-16 w-16 object-contain md:h-20 md:w-20"
              />
            </span>
            <h1 className="type-display-small text-[var(--color-on-surface)]">學生選舉系統</h1>
            <p className="mt-1.5 text-[15px] text-[var(--color-on-surface-variant)]">國立彰化師範大學學生會</p>
          </div>

          <div className="space-y-3 rounded-3xl bg-[var(--color-surface-container-lowest)] p-5 md:p-6">
            {/* 本頁唯一的主要動作 */}
            <Button
              size="lg"
              className="w-full"
              onClick={() => setIsGuideOpen(true)}
              disabled={redirecting !== null}
              loading={redirecting === "voter"}
              aria-haspopup="dialog"
              icon={<GraduationCap className="h-5 w-5" />}
            >
              以校園帳號登入
            </Button>
            {/* 說明按鈕會開啟對話框，先讓使用者知道 */}
            <p className="px-2 text-center text-xs leading-relaxed text-[var(--color-on-surface-variant)]">
              會先顯示投票說明，再前往校園單一簽入
            </p>

            <div className="h-px bg-[var(--color-outline-variant)]" role="presentation" />

            <ButtonLink to="/info/bulletin" variant="outlined" size="lg" className="w-full" icon={<FileText className="h-5 w-5" />}>
              查看選舉公報
            </ButtonLink>
          </div>

          <div className="mt-4 flex justify-center">
            <Button
              variant="text"
              color="secondary"
              size="sm"
              onClick={handleAdminLogin}
              disabled={redirecting !== null}
              loading={redirecting === "admin"}
              icon={<LockKeyhole className="h-4 w-4" />}
            >
              系統管理員登入
            </Button>
          </div>
        </div>
      </main>

      <footer className="flex flex-col items-center gap-3 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] text-center">
        <p className="flex items-center gap-1.5 text-xs text-[var(--color-on-surface-variant)]">
          <ShieldCheck className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
          採零知識證明的匿名投票系統
        </p>
        <p className="text-xs leading-relaxed text-[var(--color-on-surface-variant)]">
          &copy; 2026 Tai Ming Chen, Kuang Tsung Chiang
          <br />
          PolyForm Noncommercial License
        </p>
      </footer>

      {/* 同意流程：先看過操作說明才前往 SSO */}
      <Dialog
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        title="投票系統操作指南"
        description="前往校園單一簽入之前，請先確認以下說明。"
        className="max-w-2xl"
        actions={
          <>
            <Button variant="text" color="secondary" onClick={() => setIsGuideOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSSOConfirm}
              loading={redirecting === "voter"}
              icon={<ArrowRight className="h-4 w-4" />}
            >
              同意並繼續
            </Button>
          </>
        }
      >
        {/* Dialog 本身已經是捲動容器，這裡不要再包一層 max-h + overflow，
            否則會出現兩個互相打架的捲軸 */}
        <UserGuideContent />
      </Dialog>
    </div>
  );
};
