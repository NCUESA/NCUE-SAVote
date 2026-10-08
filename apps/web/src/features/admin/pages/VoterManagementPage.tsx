import { Navigate } from 'react-router-dom';
import { VoterImport } from '../components/VoterImport';
import { useAuth } from '../../auth/hooks/useAuth';
import { AdminHeader } from '../components/AdminHeader';
import { UserRole } from '@savote/shared-types';

export function VoterManagementPage() {
  const { user } = useAuth();

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  if (user && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (!user) return null;

  return (
    <div className="space-y-6 pb-8">
      <AdminHeader
          title="選舉人名冊"
          subtitle="匯入符合資格的選舉人名冊，並查看投票金鑰的登記狀態。"
      />

      <VoterImport />
    </div>
  );
}
