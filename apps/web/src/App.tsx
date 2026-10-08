import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./components/m3/ThemeProvider";
import { ToastContainer } from "./components/m3/ToastContainer";
import { MainLayout } from "./components/layout/MainLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { UserRole } from "@savote/shared-types";

// Lazy Pages
const LoginPage = lazy(() => import("./features/auth/pages/LoginPage").then(m => ({ default: m.LoginPage })));
const CallbackPage = lazy(() => import("./features/auth/pages/CallbackPage").then(m => ({ default: m.CallbackPage })));
//const SetupPage = lazy(() => import("./features/auth/pages/SetupPage").then(m => ({ default: m.SetupPage })));
const HomePage = lazy(() => import("./features/home/pages/HomePage").then(m => ({ default: m.HomePage })));
const VotingBooth = lazy(() => import("./features/voting/pages/VotingBooth").then(m => ({ default: m.VotingBooth })));
const VoteSuccess = lazy(() => import("./features/voting/pages/VoteSuccess").then(m => ({ default: m.VoteSuccess })));
//const KeySetupPage = lazy(() => import("./features/voting/pages/KeySetupPage").then(m => ({ default: m.KeySetupPage })));
const LotteryPage = lazy(() => import("./features/voting/pages/LotteryPage").then(m => ({ default: m.LotteryPage })))

const AdminLotteryPage = lazy(() => import("./features/admin/pages/AdminLotteryPage").then(m => ({ default: m.AdminLotteryPage })));
const AdminDashboardPage = lazy(() => import("./features/admin/pages/AdminDashboardPage").then(m => ({ default: m.AdminDashboardPage })));
const ElectionManagementPage = lazy(() => import("./features/admin/pages/ElectionManagementPage").then(m => ({ default: m.ElectionManagementPage })));
const CandidateManagementPage = lazy(() => import("./features/admin/pages/CandidateManagementPage").then(m => ({ default: m.CandidateManagementPage })));
const AdminAccountManagementPage = lazy(() => import("./features/admin/pages/AdminAccountManagementPage").then(m => ({ default: m.AdminAccountManagementPage })));
const AdminSettingsPage = lazy(() => import("./features/admin/pages/AdminSettingsPage").then(m => ({ default: m.AdminSettingsPage })));
const AdminMonitoringPage = lazy(() => import("./features/admin/pages/AdminMonitoringPage").then(m => ({ default: m.AdminMonitoringPage })));
const VoterManagementPage = lazy(() => import("./features/admin/pages/VoterManagementPage").then(m => ({ default: m.VoterManagementPage })));
const ElectionBulletinPage = lazy(() => import("./features/info/pages/ElectionBulletinPage").then(m => ({ default: m.ElectionBulletinPage })));
const PublicResultsPage = lazy(() => import("./features/voting/pages/PublicResultsPage").then(m => ({ default: m.PublicResultsPage })));

// Auth Error (Static import to ensure it shows up immediately on failure)
import { AuthError } from "./components/AuthError";
import { useAuth } from "./features/auth/hooks/useAuth";

const BulletinWrapper = () => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <MainLayout><ElectionBulletinPage /></MainLayout>;
  }
  return <ElectionBulletinPage />;
};

/** 路由切換時的載入畫面：原本是空白 div，慢速行動網路下會是一片全白 */
const RouteFallback = () => (
  <div
    role="status"
    aria-label="載入中"
    className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--color-surface)] px-6"
  >
    <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--color-outline-variant)] border-t-[var(--color-primary)]" />
    <p className="text-sm text-[var(--color-on-surface-variant)]">載入中…</p>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 選舉資料會隨時間變動（開始/結束），但不需要每次聚焦視窗就重抓
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastContainer />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<CallbackPage />} />
              <Route path="/auth/error" element={<AuthError />} />
              <Route path="/auth/unauthorized" element={<AuthError />} />
              <Route path="/info/bulletin" element={<BulletinWrapper />} />

              {/* Protected Voter Routes with Persistent Layout */}
              <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                {/* Voter Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/vote/:electionId" element={<VotingBooth />} />
                <Route path="/vote/success" element={<VoteSuccess />} />
                <Route path="/:electionId/results" element={< PublicResultsPage />} />
                <Route path="/lottery" element={< LotteryPage />} />

                {/* Admin Routes */}
                <Route path="/admin" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}><AdminDashboardPage /></ProtectedRoute>} />
                <Route path="/admin/elections" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}><ElectionManagementPage /></ProtectedRoute>} />
                <Route path="/admin/elections/:electionId/candidates" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}><CandidateManagementPage /></ProtectedRoute>} />
                <Route path="/admin/voters" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}><VoterManagementPage /></ProtectedRoute>} />
                <Route path="/admin/monitoring" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}><AdminMonitoringPage /></ProtectedRoute>} />
                <Route path="/admin/lottery" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}><AdminLotteryPage /></ProtectedRoute>} />
                {/* Super Admin Routes */}
                <Route path="/admin/accounts" element={<ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}><AdminAccountManagementPage /></ProtectedRoute>} />
                <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}><AdminSettingsPage /></ProtectedRoute>} />
              </Route>

              {/* Fallback：原本指向 /admin，一般選舉人會被丟進無權限的後台並觸發重導向迴圈 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
