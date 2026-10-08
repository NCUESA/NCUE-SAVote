import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/hooks/useAuth';
import { Button, ButtonLink } from '../../../components/m3/Button';
import { Dialog } from '../../../components/m3/Dialog';
import { TextField } from '../../../components/m3/TextField';
import { AdminHeader } from '../components/AdminHeader';
import { api } from '../../auth/services/auth.api';
import { API_ENDPOINTS } from '../../../lib/constants';
import { ElectionType, type Election, UserRole } from '@savote/shared-types';
import { Plus, CalendarPlus, Link as LinkIcon, Users, Trash2, Edit2, Search, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useToastStore } from '../../../stores/toastStore';
import { formatDateTime } from '../../../lib/datetime';
import { Section } from '../../../components/ui/Section';
import { SearchField } from '../../../components/ui/SearchField';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatusBadge, type StatusTone } from '../../../components/ui/StatusBadge';
import { IconButton } from '../../../components/ui/IconButton';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Notice } from '../../../components/ui/Notice';

interface ExtendedElection extends Election {
    description?: string;
}

export const ELECTION_TYPE_LABELS: Record<string, string> = {
    [ElectionType.PRESIDENTIAL]: '正副會長選舉',
    [ElectionType.DISTRICT_COUNCILOR]: '選區議員選舉',
    [ElectionType.AT_LARGE_COUNCILOR]: '不分區議員選舉',
};

export function ElectionManagementPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { addToast } = useToastStore();
    // 刪除選舉會連同選票一起 cascade 刪除，是不可逆的高風險操作，
    // 用正式的確認對話框而不是 window.confirm
    const [deleteTarget, setDeleteTarget] = useState<Election | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingElection, setEditingElection] = useState<ExtendedElection | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        type: ElectionType.PRESIDENTIAL,
        startTime: '',
        endTime: '',
        bulletinUrl: '',
    });

    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

    // Fetch Elections
    const { data: elections = [], isLoading } = useQuery({
        queryKey: ['admin', 'elections'],
        queryFn: async () => {
            const response = await api.get<ExtendedElection[]>(API_ENDPOINTS.ELECTIONS.ALLLIST);
            return response.data;
        },
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: any) => api.post(API_ENDPOINTS.ELECTIONS.CREATE, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'elections'] });
            setIsCreateOpen(false);
            resetForm();
            addToast('選舉建立成功', 'success');
        },
        onError: (error: any) => {
            const msg = error.response?.data?.message;
            addToast(`建立失敗：${Array.isArray(msg) ? msg.join(', ') : msg || '伺服器錯誤'}`, 'error');
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string; payload: any }) => api.patch(`${API_ENDPOINTS.ELECTIONS.CREATE}/${data.id}`, data.payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'elections'] });
            setIsCreateOpen(false);
            resetForm();
            addToast('選舉修改成功', 'success');
        },
        onError: (error: any) => {
            const msg = error.response?.data?.message;
            addToast(`修改失敗：${Array.isArray(msg) ? msg.join(', ') : msg || '伺服器錯誤'}`, 'error');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`${API_ENDPOINTS.ELECTIONS.CREATE}/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'elections'] });
            addToast('選舉已刪除', 'info');
        },
    });

    const resetForm = () => {
        setEditingElection(null);
        setFormData({ name: '', description: '', type: ElectionType.PRESIDENTIAL, startTime: '', endTime: '', bulletinUrl: '' });
    };

    const handleOpenCreate = () => { resetForm(); setIsCreateOpen(true); };

    const handleOpenEdit = (election: ExtendedElection) => {
        setEditingElection(election);
        setFormData({
            name: election.name,
            description: election.description || '',
            type: election.type as ElectionType,
            startTime: formatDateTimeLocal(election.startTime),
            endTime: formatDateTimeLocal(election.endTime),
            bulletinUrl: (election.config as any)?.bulletinUrl || '',
        });
        setIsCreateOpen(true);
    };

    const formatDateTimeLocal = (dateString: string | Date | null | undefined) => {
        if (!dateString) return "";

        const d = new Date(dateString);

        // Turn into TPE timezone
        const taipeiTimeStr = d.toLocaleString("sv-SE", { timeZone: "Asia/Taipei" });

        return taipeiTimeStr.replace(" ", "T").slice(0, 16);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Frontend Validation
        if (!formData.name.trim()) return addToast('請填寫選舉名稱', 'warning');
        if (!formData.type) return addToast('請選擇選舉種類', 'warning');
        if (!formData.startTime) return addToast('請設定開始投票時間', 'warning');
        if (!formData.endTime) return addToast('請設定結束投票時間', 'warning');

        const start = new Date(formData.startTime);
        const end = new Date(formData.endTime);
        if (end <= start) return addToast('結束時間必須晚於開始時間', 'warning');

        const payload: any = {
            name: formData.name,
            description: formData.description,
            type: formData.type,
            config: { bulletinUrl: formData.bulletinUrl },
            startTime: start.toISOString(),
            endTime: end.toISOString(),
        };

        if (editingElection) updateMutation.mutate({ id: editingElection.id, payload });
        else createMutation.mutate(payload);
    };

    const toggleVisibilityMutation = useMutation({
        mutationFn: (data: { id: string; isVisible: boolean }) => api.patch(`${API_ENDPOINTS.ELECTIONS.CREATE}/${data.id}/visibility`, { isVisible: data.isVisible }),
        onSuccess: (data, variables) => {
            // Invalidate the election list to trigger a background refresh
            queryClient.invalidateQueries({ queryKey: ['admin', 'elections'] });
            data = data;
            const status = variables.isVisible ? '公開' : '隱藏';
            addToast(`顯示已設定為${status}`, 'success');
        },
        onError: (error: any) => {
            const msg = error.response?.data?.message;
            addToast(`更新失敗：${Array.isArray(msg) ? msg.join(', ') : msg || '伺服器錯誤'}`, 'error');
        }
    });

    const handleToggleVisibility = (election: any, targetVisibility: boolean) => {
        toggleVisibilityMutation.mutate({
            id: election.id,
            isVisible: targetVisibility
        });
    };

    const getStatus = (election: Election): { label: string; tone: StatusTone; started: boolean } => {
        const now = new Date();
        const start = election.startTime ? new Date(election.startTime) : null;
        const end = election.endTime ? new Date(election.endTime) : null;
        if (!start || !end) return { label: '設定未完成', tone: 'neutral', started: false };
        if (now < start) return { label: '即將開始', tone: 'warning', started: false };
        if (now <= end) return { label: '投票進行中', tone: 'success', started: true };
        return { label: '已結束', tone: 'neutral', started: true };
    };

    if (user && !isAdmin) return <Navigate to="/" replace />;
    if (!user) return null;

    const term = searchTerm.trim().toLowerCase();
    const filteredElections = (elections as ExtendedElection[]).filter(e => e.name.toLowerCase().includes(term));

    return (
        <div className="space-y-6 pb-8">
            <AdminHeader
                title="選舉管理"
                subtitle="建立與修改各項選舉。狀態會依投票時間自動判定；選舉開始後即不可修改或刪除。"
                actions={
                    <Button icon={<Plus className="h-5 w-5" />} onClick={handleOpenCreate}>
                        建立選舉
                    </Button>
                }
            />

            <Section title="所有選舉" description={isLoading ? undefined : `共 ${elections.length} 場`} card={false}>
                {elections.length > 0 && (
                    <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="搜尋選舉名稱" />
                )}

                {isLoading ? (
                    <div className="space-y-px overflow-hidden rounded-3xl">
                        {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-none" />)}
                    </div>
                ) : elections.length === 0 ? (
                    <EmptyState
                        icon={CalendarPlus}
                        title="尚未建立任何選舉"
                        description="建立選舉後，即可設定候選人與匯入選舉人名冊。"
                        action={<Button variant="tonal" icon={<Plus className="h-4 w-4" />} onClick={handleOpenCreate}>建立第一場選舉</Button>}
                    />
                ) : filteredElections.length === 0 ? (
                    <EmptyState icon={Search} title="沒有符合的選舉" description="試試其他關鍵字，或清除搜尋條件。" />
                ) : (
                    <ul className="list-none divide-y divide-[var(--color-outline-variant)] overflow-hidden rounded-3xl bg-[var(--color-surface-container-lowest)] p-0">
                        {filteredElections.map((election) => {
                            const status = getStatus(election);
                            // 選舉一旦開始就不可修改。保留按鈕並停用，由 aria-label 與 title 說明原因，
                            // 而不是直接拿掉讓管理員以為按鈕不見了。
                            const lockReason = `選舉已於 ${formatDateTime(election.startTime)} 開始，依選務規則不可`;
                            // 進行中的選舉不可切換公開狀態
                            const canToggleVisibility = !(status.started && status.label === '投票進行中');
                            return (
                                <li key={election.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-5 md:px-5">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <StatusBadge tone={status.tone} pulse={status.tone === 'success'}>{status.label}</StatusBadge>
                                            {!election.isVisible && (
                                                <StatusBadge tone="neutral" icon={EyeOff}>未公開</StatusBadge>
                                            )}
                                            <span className="text-[13px] text-[var(--color-on-surface-variant)]">
                                                {ELECTION_TYPE_LABELS[election.type] || election.type}
                                            </span>
                                        </div>
                                        <h3 className="type-title-medium mt-2 text-[var(--color-on-surface)]">{election.name}</h3>
                                        <p className="tabular mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-[var(--color-on-surface-variant)]">
                                            <span>{formatDateTime(election.startTime)}</span>
                                            <ArrowRight className="h-3.5 w-3.5" aria-label="至" />
                                            <span>{formatDateTime(election.endTime)}</span>
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <ButtonLink
                                            to={`/admin/elections/${election.id}/candidates`}
                                            variant="tonal"
                                            size="sm"
                                            className="mr-auto md:mr-2"
                                            icon={<Users className="h-4 w-4" />}
                                        >
                                            候選人
                                        </ButtonLink>
                                        <IconButton
                                            disabled={!canToggleVisibility || toggleVisibilityMutation.isPending}
                                            onClick={() => handleToggleVisibility(election, !election.isVisible)}
                                            aria-pressed={election.isVisible}
                                            aria-label={election.isVisible
                                                ? `「${election.name}」目前對選民公開，點擊改為隱藏`
                                                : `「${election.name}」目前對選民隱藏，點擊改為公開`}
                                            title={election.isVisible ? '公開中（點擊隱藏）' : '已隱藏（點擊公開）'}
                                        >
                                            {election.isVisible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                                        </IconButton>
                                        <IconButton
                                            disabled={status.started}
                                            onClick={() => handleOpenEdit(election)}
                                            title={status.started ? `${lockReason}修改` : '編輯'}
                                            aria-label={status.started ? `編輯「${election.name}」：${lockReason}修改` : `編輯「${election.name}」`}
                                        >
                                            <Edit2 aria-hidden="true" />
                                        </IconButton>
                                        <IconButton
                                            tone="error"
                                            disabled={status.started}
                                            onClick={() => setDeleteTarget(election)}
                                            title={status.started ? `${lockReason}刪除` : '刪除'}
                                            aria-label={status.started ? `刪除「${election.name}」：${lockReason}刪除` : `刪除「${election.name}」`}
                                        >
                                            <Trash2 aria-hidden="true" />
                                        </IconButton>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Section>

            {/* Create/Edit Dialog */}
            <Dialog
                open={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title={editingElection ? '編輯選舉' : '建立選舉'}
                className="w-full max-w-2xl"
                actions={
                    <>
                        <Button variant="text" color="secondary" onClick={() => setIsCreateOpen(false)}>
                            取消
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={createMutation.isPending || updateMutation.isPending}
                            loading={createMutation.isPending || updateMutation.isPending}
                        >
                            {editingElection ? '儲存變更' : '建立選舉'}
                        </Button>
                    </>
                }
            >
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <TextField
                            label="選舉名稱"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                            className="md:col-span-2"
                        />

                        <div className="space-y-1.5 md:col-span-2">
                            <p className="text-sm font-semibold text-[var(--color-on-surface)]">
                                選舉種類 <span className="text-[var(--color-error)]">*</span>
                            </p>
                            <SegmentedControl
                                label="選舉種類"
                                value={formData.type}
                                onChange={(type) => setFormData({ ...formData, type })}
                                options={[
                                    { value: ElectionType.PRESIDENTIAL, label: '正副會長' },
                                    { value: ElectionType.DISTRICT_COUNCILOR, label: '選區議員' },
                                    { value: ElectionType.AT_LARGE_COUNCILOR, label: '不分區議員' },
                                ]}
                            />
                        </div>

                        <TextField
                            label="開始投票時間"
                            type="datetime-local"
                            value={formData.startTime}
                            onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                            required
                        />
                        <TextField
                            label="結束投票時間"
                            type="datetime-local"
                            value={formData.endTime}
                            onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                            required
                        />

                        <TextField
                            label="選舉公報連結（選填）"
                            value={formData.bulletinUrl}
                            onChange={e => setFormData({ ...formData, bulletinUrl: e.target.value })}
                            placeholder="請輸入 Google Drive 共享連結"
                            endAdornment={<LinkIcon className="w-4 h-4 opacity-50" />}
                            className="md:col-span-2"
                        />

                        <TextField
                            label="選舉說明（選填）"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            multiline
                            rows={3}
                            className="md:col-span-2"
                        />
                    </div>
                </form>
            </Dialog>

            {/* 刪除確認：這是不可逆操作，而且會連同該場選舉的所有選票一起刪除，
                所以要求管理員親手輸入選舉名稱才能執行，而不是按一下就過。 */}
            <DeleteElectionDialog
                election={deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={(id) => {
                    deleteMutation.mutate(id);
                    setDeleteTarget(null);
                }}
                isPending={deleteMutation.isPending}
            />
        </div>
    );
}

function DeleteElectionDialog({
    election,
    onClose,
    onConfirm,
    isPending,
}: {
    election: Election | null;
    onClose: () => void;
    onConfirm: (id: string) => void;
    isPending: boolean;
}) {
    const [typed, setTyped] = useState('');

    // 換一筆目標就把輸入清掉，避免沿用上一次打的名稱
    const confirmed = Boolean(election) && typed.trim() === election?.name.trim();

    return (
        <Dialog
            open={Boolean(election)}
            onClose={() => {
                setTyped('');
                onClose();
            }}
            title="刪除選舉"
            actions={
                <>
                    <Button
                        variant="text"
                        color="secondary"
                        onClick={() => {
                            setTyped('');
                            onClose();
                        }}
                    >
                        取消
                    </Button>
                    <Button
                        color="error"
                        disabled={!confirmed || isPending}
                        loading={isPending}
                        onClick={() => {
                            if (election && confirmed) {
                                setTyped('');
                                onConfirm(election.id);
                            }
                        }}
                    >
                        永久刪除
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <Notice tone="error" title="此操作無法復原">
                    該場選舉的候選人、選舉人名冊與所有已投選票都會一併刪除。
                </Notice>

                <TextField
                    label="請輸入選舉名稱以確認"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    helperText={election ? `要刪除的是：${election.name}` : undefined}
                />
            </div>
        </Dialog>
    );
}
