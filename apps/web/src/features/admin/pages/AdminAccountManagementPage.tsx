import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import { api } from '../../auth/services/auth.api';
import { Button } from '../../../components/m3/Button';
import { TextField } from '../../../components/m3/TextField';
import { AdminHeader } from '../components/AdminHeader';
import { Trash2, UserPlus, ShieldCheck, User, Users } from 'lucide-react';
import { UserRole, ApiResponse } from '@savote/shared-types';
import { ConfirmDialog } from '../../../components/m3/ConfirmDialog';
import { formatDate } from '../../../lib/datetime';
import { Section } from '../../../components/ui/Section';
import { SearchField } from '../../../components/ui/SearchField';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { IconTile } from '../../../components/ui/IconTile';

interface AdminPermission {
  id: string;
  synologySub: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export function AdminAccountManagementPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newAdmin, setNewAdmin] = useState({ synologySub: '', name: '', role: UserRole.ADMIN });
  // 移除管理權限是高風險操作，用正式的確認對話框而不是 window.confirm
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  // Hooks 必須在任何 early return 之前呼叫（原本寫在權限檢查之後，違反 Rules of Hooks）
  const { data, isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AdminPermission[]>>('/admins');
      return res.data;
    },
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newAdmin) => api.post('/admins', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admins'] }); setNewAdmin({ synologySub: '', name: '', role: UserRole.ADMIN }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admins/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admins'] }); },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string, role: UserRole }) => api.patch(`/admins/${id}/role`, { role }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admins'] }); },
  });

  if (user && !isAdmin) return <Navigate to="/" replace />;
  if (!user) return null;

  const admins = data?.data || [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdmin.synologySub || !newAdmin.name) return;
    createMutation.mutate(newAdmin);
  };

  const term = searchTerm.trim().toLowerCase();
  const filteredAdmins = admins.filter(a =>
    a.name?.toLowerCase().includes(term) ||
    a.synologySub.toLowerCase().includes(term)
  );

  return (
    <div className="space-y-6 pb-8">
      <AdminHeader title="權限管理" subtitle="管理可以進入後台的帳號與其權限級別。" />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* 管理員清單 */}
        <Section
          className="lg:col-span-8"
          title="管理員"
          description={isLoading ? undefined : `共 ${admins.length} 位`}
          card={false}
        >
          <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="搜尋姓名或帳號" />

          {isLoading ? (
            <div className="space-y-px overflow-hidden rounded-3xl">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-[72px] rounded-none" />)}
            </div>
          ) : filteredAdmins.length === 0 ? (
            <EmptyState
              icon={Users}
              title={term ? '沒有符合的管理員' : '尚未加入任何管理員'}
              description={term ? '試試其他關鍵字，或清除搜尋條件。' : '使用右側表單加入第一位管理員。'}
            />
          ) : (
            <ul className="list-none divide-y divide-[var(--color-outline-variant)] overflow-hidden rounded-3xl bg-[var(--color-surface-container-lowest)] p-0">
              {filteredAdmins.map((admin) => {
                const isMe = admin.synologySub === user?.synologySub;
                const isSuper = admin.role === UserRole.SUPER_ADMIN;
                const editable = isSuperAdmin && !isMe;
                return (
                  <li key={admin.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 md:px-5">
                    <IconTile icon={isSuper ? ShieldCheck : User} tone={isSuper ? 'tertiary' : 'primary'} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="type-title-small truncate text-[var(--color-on-surface)]">{admin.name}</span>
                        {isMe && <StatusBadge tone="neutral" icon={null}>我</StatusBadge>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-[var(--color-on-surface-variant)]">
                        <span className="font-mono">{admin.synologySub}</span>
                        <span className="tabular">加入於 {formatDate(admin.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                      {editable ? (
                        <Select
                          size="sm"
                          aria-label={`「${admin.name}」的權限級別`}
                          value={admin.role}
                          disabled={updateRoleMutation.isPending}
                          onChange={(e) => updateRoleMutation.mutate({ id: admin.id, role: e.target.value as UserRole })}
                        >
                          <option value={UserRole.ADMIN}>管理員</option>
                          <option value={UserRole.SUPER_ADMIN}>超級管理員</option>
                        </Select>
                      ) : (
                        <StatusBadge tone={isSuper ? 'tertiary' : 'info'} icon={null}>
                          {isSuper ? '超級管理員' : '管理員'}
                        </StatusBadge>
                      )}
                      {editable && (
                        <button
                          type="button"
                          className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-error)] transition-colors duration-[var(--dur-micro)] hover:bg-[var(--color-error)]/[0.08] disabled:opacity-40"
                          onClick={() => setRemoveTarget({ id: admin.id, name: admin.name })}
                          aria-label={`移除「${admin.name}」的管理權限`}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* 新增管理員 */}
        <Section className="lg:sticky lg:top-24 lg:col-span-4" title="新增管理員">
          <form onSubmit={handleCreate} className="space-y-4">
            <TextField
              label="姓名"
              value={newAdmin.name}
              onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
              required
            />
            <TextField
              label="Keycloak 帳號（Username）"
              placeholder="例如：M1154007"
              value={newAdmin.synologySub}
              onChange={(e) => setNewAdmin({ ...newAdmin, synologySub: e.target.value })}
              helperText="請填帳號名稱，不是 Keycloak 後台顯示的 UUID；填錯該員將無法登入後台。"
              required
            />
            <Select
              label="權限級別"
              value={newAdmin.role}
              onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value as UserRole })}
            >
              <option value={UserRole.ADMIN}>管理員</option>
              {isSuperAdmin && <option value={UserRole.SUPER_ADMIN}>超級管理員</option>}
            </Select>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!newAdmin.synologySub || !newAdmin.name}
              loading={createMutation.isPending}
              icon={<UserPlus className="h-5 w-5" />}
            >
              加入管理員
            </Button>
          </form>
        </Section>
      </div>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) deleteMutation.mutate(removeTarget.id);
          setRemoveTarget(null);
        }}
        tone="destructive"
        title="移除管理權限"
        confirmLabel="移除權限"
        loading={deleteMutation.isPending}
        description={
          <>
            將移除「{removeTarget?.name}」的後台管理權限。該帳號之後登入會被降為一般選舉人，
            且無法再進入任何管理介面。若需恢復，必須由超級管理員重新加入名單。
          </>
        }
      />
    </div>
  );
}
