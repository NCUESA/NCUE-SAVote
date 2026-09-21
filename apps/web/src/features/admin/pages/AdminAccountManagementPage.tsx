import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import { api } from '../../auth/services/auth.api';
import { Card } from '../../../components/m3/Card';
import { Button } from '../../../components/m3/Button';
import { TextField } from '../../../components/m3/TextField';
import { AdminHeader } from '../components/AdminHeader';
import { 
  Trash2, 
  Search, 
  UserPlus, 
  Fingerprint, 
  ShieldCheck, 
  User, 
  Clock, 
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { UserRole, ApiResponse } from '@savote/shared-types';

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
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  // Access control
  if (user && !isAdmin) return <Navigate to="/" replace />;
  if (!user) return null;

  // Fetch Admins
  const { data, isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AdminPermission[]>>('/admins');
      return res.data;
    },
  });

  const admins = data?.data || [];

  // Mutations
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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdmin.synologySub || !newAdmin.name) return;
    createMutation.mutate(newAdmin);
  };

  const filteredAdmins = admins.filter(a => 
    a.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.synologySub.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in pb-24 select-none">
      <AdminHeader 
        title="權限管理"
        subtitle="管理系統管理員名單及其權限級別"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
        
        {/* Create Admin Form */}
        <div className="lg:col-span-4 order-2 lg:order-1 lg:sticky lg:top-24">
            <Card className="p-6 md:p-8 rounded-xl bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/30 elevation-1">
                <div className="flex items-center gap-4 mb-6 md:mb-8">
                    <div className="p-3 bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] rounded-xl elevation-1">
                        <UserPlus className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg md:text-xl font-bold text-[var(--color-on-surface)]">新增管理權限</h2>
                        <p className="text-[10px] md:text-xs text-[var(--color-on-surface-variant)] opacity-70 uppercase tracking-wider">Authorize OIDC Account</p>
                    </div>
                </div>
                
                <form onSubmit={handleCreate} className="space-y-5 md:space-y-6">
                    <TextField
                        label="管理員姓名"
                        value={newAdmin.name}
                        onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                        required
                    />
                    
                    <TextField
                        label="Keycloak 帳號 (Username)"
                        placeholder="例如：M1154007"
                        value={newAdmin.synologySub}
                        onChange={(e) => setNewAdmin({ ...newAdmin, synologySub: e.target.value })}
                        required
                        endAdornment={<Fingerprint className="w-4 h-4 opacity-50" />}
                    />

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[var(--color-on-surface-variant)] px-1">權限級別</label>
                        <select 
                            className="w-full h-12 md:h-14 px-5 md:px-6 rounded-xl bg-[var(--color-surface-container-high)] border-none text-[var(--color-on-surface)] font-medium transition-all outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 cursor-pointer appearance-none elevation-1"
                            value={newAdmin.role}
                            onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value as UserRole })}
                        >
                            <option value={UserRole.ADMIN}>系統管理員 (ADMIN)</option>
                            {isSuperAdmin && <option value={UserRole.SUPER_ADMIN}>超級管理員 (SUPER)</option>}
                        </select>
                    </div>

                    <Button 
                        type="submit" 
                        className="w-full h-12 md:h-14 rounded-xl shadow-lg shadow-[var(--color-primary)]/10 mt-2 font-bold"
                        disabled={createMutation.isPending || !newAdmin.synologySub || !newAdmin.name}
                        loading={createMutation.isPending}
                        variant="filled"
                    >
                        確認授權加入
                    </Button>
                </form>

                <div className="mt-6 md:mt-8 flex gap-3 items-start text-[10px] md:text-[11px] text-[var(--color-on-surface-variant)] opacity-60 bg-[var(--color-surface-container-highest)]/50 p-4 rounded-xl border border-[var(--color-outline-variant)]/20">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500" />
                    <p>請填入該員在 Keycloak 的帳號名稱 (Username)，不是 Keycloak 後台顯示的 UUID；若輸入錯誤將導致該員無法登入管理介面。</p>
                </div>
            </Card>
        </div>

        {/* Admin List */}
        <div className="lg:col-span-8 order-1 lg:order-2 space-y-4 md:space-y-6">
            
            {/* Search */}
            <div className="relative group">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-[var(--color-outline)] group-focus-within:text-[var(--color-primary)] transition-colors" />
                </div>
                <input 
                    type="text" 
                    placeholder="搜尋管理員姓名或 UID..."
                    className="w-full h-14 md:h-16 pl-14 md:pl-16 pr-6 bg-[var(--color-surface-container-low)] rounded-xl border border-transparent focus:border-[var(--color-primary)]/30 focus:bg-[var(--color-surface)] text-[var(--color-on-surface)] transition-all outline-none elevation-1 focus:elevation-2"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* List Container */}
            {isLoading ? (
                <div className="grid gap-4">
                    {[1,2,3].map(i => <div key={i} className="h-20 md:h-24 bg-[var(--color-surface-container)] rounded-xl animate-pulse" />)}
                </div>
            ) : filteredAdmins.length === 0 ? (
                <div className="bg-[var(--color-surface-container-low)] rounded-xl border-2 border-dashed border-[var(--color-outline-variant)] py-16 md:py-24 text-center">
                    <div className="p-5 md:p-6 rounded-full bg-[var(--color-surface-container-high)] w-fit mx-auto mb-4 md:mb-6">
                        <User className="w-10 h-10 md:w-12 md:h-12 text-[var(--color-outline)] opacity-20" />
                    </div>
                    <p className="text-lg md:text-xl font-bold text-[var(--color-on-surface-variant)] opacity-50">未找到符合條件的管理員</p>
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-[var(--color-surface-container-low)] rounded-xl border border-[var(--color-outline-variant)]/30 overflow-hidden elevation-1">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[var(--color-surface-container-high)]/50 border-b border-[var(--color-outline-variant)]/30">
                                        <th className="px-8 py-5 text-sm font-bold text-[var(--color-on-surface-variant)] opacity-70">管理員資訊</th>
                                        <th className="px-6 py-5 text-sm font-bold text-[var(--color-on-surface-variant)] opacity-70">權限級別</th>
                                        <th className="px-6 py-5 text-sm font-bold text-[var(--color-on-surface-variant)] opacity-70 hidden lg:table-cell">加入時間</th>
                                        <th className="px-8 py-5 text-sm font-bold text-[var(--color-on-surface-variant)] opacity-70 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-outline-variant)]/20">
                                    {filteredAdmins.map((admin) => (
                                        <tr 
                                            key={admin.id} 
                                            className={cn(
                                                "group transition-all duration-300",
                                                admin.synologySub === user?.synologySub 
                                                    ? "bg-[var(--color-primary-container)]/5" 
                                                    : "hover:bg-[var(--color-surface)]"
                                            )}
                                        >
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 elevation-1 transition-transform group-hover:scale-105",
                                                        admin.role === UserRole.SUPER_ADMIN 
                                                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" 
                                                            : "bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)]"
                                                    )}>
                                                        {admin.role === UserRole.SUPER_ADMIN ? <ShieldCheck className="w-6 h-6" /> : <User className="w-6 h-6" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-[var(--color-on-surface)] text-lg truncate">
                                                                {admin.name}
                                                            </span>
                                                            {admin.synologySub === user?.synologySub && (
                                                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-[var(--color-tertiary-container)] text-[var(--color-on-tertiary-container)] uppercase tracking-widest">
                                                                    ME
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-[var(--color-on-surface-variant)] opacity-60 font-mono">
                                                            <Fingerprint className="w-3 h-3" />
                                                            {admin.synologySub}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6">
                                                <div className="flex items-center gap-3">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-[9px] font-medium tracking-widest uppercase",
                                                        admin.role === UserRole.SUPER_ADMIN 
                                                            ? "bg-amber-500 text-white shadow-sm shadow-amber-500/20" 
                                                            : "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                                                    )}>
                                                        {admin.role}
                                                    </span>
                                                    
                                                    {isSuperAdmin && admin.synologySub !== user?.synologySub && (
                                                        <select 
                                                            className="h-8 px-2 rounded-lg bg-[var(--color-surface-container-high)] border-none text-[9px] font-medium focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-all outline-none cursor-pointer appearance-none elevation-1"
                                                            value={admin.role}
                                                            onChange={(e) => updateRoleMutation.mutate({ id: admin.id, role: e.target.value as UserRole })}
                                                        >
                                                            <option value={UserRole.ADMIN}>ADMIN</option>
                                                            <option value={UserRole.SUPER_ADMIN}>SUPER</option>
                                                        </select>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 hidden lg:table-cell">
                                                <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-on-surface-variant)] opacity-60">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {new Date(admin.createdAt).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                {isSuperAdmin && admin.synologySub !== user?.synologySub && (
                                                    <button 
                                                        className="w-10 h-10 rounded-xl hover:bg-[var(--color-error-container)] hover:text-[var(--color-on-error-container)] text-[var(--color-error)] opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center inline-flex"
                                                        onClick={() => { if(window.confirm(`確定要移除 ${admin.name} 的管理權限嗎？`)) deleteMutation.mutate(admin.id); }}
                                                        disabled={deleteMutation.isPending}
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                                {admin.synologySub !== user?.synologySub && (
                                                    <ChevronRight className="w-5 h-5 text-[var(--color-outline)] opacity-20 group-hover:translate-x-1 transition-all inline-flex ml-2" />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                        {filteredAdmins.map((admin) => (
                            <Card 
                                key={admin.id} 
                                className={cn(
                                    "p-5 rounded-xl border border-[var(--color-outline-variant)]/20 elevation-1",
                                    admin.synologySub === user?.synologySub ? "bg-[var(--color-primary-container)]/5 border-[var(--color-primary)]/20" : "bg-[var(--color-surface-container-low)]"
                                )}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 elevation-1",
                                            admin.role === UserRole.SUPER_ADMIN 
                                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30" 
                                                : "bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)]"
                                        )}>
                                            {admin.role === UserRole.SUPER_ADMIN ? <ShieldCheck className="w-5 h-5" /> : <User className="w-5 h-5" />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-[var(--color-on-surface)] truncate">
                                                    {admin.name}
                                                </span>
                                                {admin.synologySub === user?.synologySub && (
                                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[var(--color-tertiary-container)] text-[var(--color-on-tertiary-container)] uppercase">
                                                        ME
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-[var(--color-on-surface-variant)] opacity-60 font-mono break-all">
                                                {admin.synologySub}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {isSuperAdmin && admin.synologySub !== user?.synologySub && (
                                        <button 
                                            className="w-8 h-8 rounded-lg bg-[var(--color-error-container)]/10 text-[var(--color-error)] flex items-center justify-center"
                                            onClick={() => { if(window.confirm(`確定要移除 ${admin.name} 的管理權限嗎？`)) deleteMutation.mutate(admin.id); }}
                                            disabled={deleteMutation.isPending}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-[var(--color-outline-variant)]/10">
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[9px] font-medium tracking-widest uppercase",
                                            admin.role === UserRole.SUPER_ADMIN ? "bg-amber-500 text-white" : "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                                        )}>
                                            {admin.role}
                                        </span>
                                        {isSuperAdmin && admin.synologySub !== user?.synologySub && (
                                            <select 
                                                className="h-7 px-1.5 rounded-lg bg-[var(--color-surface-container-high)] text-[9px] font-medium outline-none appearance-none border border-[var(--color-outline-variant)]/20"
                                                value={admin.role}
                                                onChange={(e) => updateRoleMutation.mutate({ id: admin.id, role: e.target.value as UserRole })}
                                            >
                                                <option value={UserRole.ADMIN}>ADMIN</option>
                                                <option value={UserRole.SUPER_ADMIN}>SUPER</option>
                                            </select>
                                        )}
                                    </div>
                                    <div className="text-[10px] font-medium text-[var(--color-on-surface-variant)] opacity-50 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(admin.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </>
            )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
