import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/hooks/useAuth';
import { candidateApi } from '../../auth/services/candidate.api';
import { api } from '../../auth/services/auth.api';
import { API_ENDPOINTS } from '../../../lib/constants';
import { Button } from '../../../components/m3/Button';
import { Dialog } from '../../../components/m3/Dialog';
import { ConfirmDialog } from '../../../components/m3/ConfirmDialog';
import { TextField } from '../../../components/m3/TextField';
import { Plus, Trash2, Pencil, UserCircle, Image as ImageIcon, Lock } from 'lucide-react';
import { type Election, type Candidate, UserRole } from '@savote/shared-types';
import { useToastStore } from '../../../stores/toastStore';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Section } from '../../../components/ui/Section';
import { Notice } from '../../../components/ui/Notice';
import { EmptyState } from '../../../components/ui/EmptyState';
import { IconButton } from '../../../components/ui/IconButton';

interface ExtendedCandidate extends Candidate {
    bio?: string;
    photoUrl?: string;
}

/** 候選人頭像：有照片用照片，沒有或載入失敗就用姓名首字 */
function CandidateAvatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-14 w-14 shrink-0 rounded-2xl bg-[var(--color-surface-container)] object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-container)] text-xl font-semibold text-[var(--color-on-primary-container)]"
    >
      {name.charAt(0)}
    </span>
  );
}

export function CandidateManagementPage() {
  const { user } = useAuth();
  const { electionId } = useParams();
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<ExtendedCandidate | null>(null);
  const [formData, setFormData] = useState({ name: '', bio: '', photoUrl: '' });
  const [deleteTarget, setDeleteTarget] = useState<ExtendedCandidate | null>(null);

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const { data: election, isLoading: isLoadingElection } = useQuery({
    queryKey: ['election', electionId],
    queryFn: async () => {
      if (!electionId) return null;
      const res = await api.get<Election>(API_ENDPOINTS.ELECTIONS.GET(electionId));
      return res.data;
    },
    enabled: !!electionId,
  });

  const isLocked = election?.startTime ? new Date() >= new Date(election.startTime) : false;

  const { data: candidates = [], isLoading: isLoadingCandidates } = useQuery({
    queryKey: ['admin', 'candidates', electionId],
    queryFn: async () => {
        const res = await candidateApi.findAll(electionId!);
        return res as ExtendedCandidate[];
    },
    enabled: !!electionId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => candidateApi.create(electionId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'candidates', electionId] });
      setIsCreateOpen(false);
      setFormData({ name: '', bio: '', photoUrl: '' });
      addToast('候選人已成功新增', 'success');
    },
    onError: (error: any) => {
        addToast(`新增失敗: ${error.response?.data?.message || '未知錯誤'}`, 'error');
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; dto: any }) => candidateApi.update(data.id, data.dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'candidates', electionId] });
      setIsCreateOpen(false);
      setEditingCandidate(null);
      setFormData({ name: '', bio: '', photoUrl: '' });
      addToast('候選人資訊已更新', 'success');
    },
    onError: (error: any) => {
        addToast(`更新失敗: ${error.response?.data?.message || '未知錯誤'}`, 'error');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => candidateApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'candidates', electionId] });
      addToast('候選人已移除', 'info');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    if (!formData.name.trim()) {
        addToast('請輸入候選人姓名', 'warning');
        return;
    }

    const payload: any = { name: formData.name, bio: formData.bio };
    if (formData.photoUrl && formData.photoUrl.trim() !== '') {
        payload.photoUrl = formData.photoUrl;
    }

    if (editingCandidate) {
      updateMutation.mutate({ id: editingCandidate.id, dto: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openCreate = () => {
    if (isLocked) return;
    setEditingCandidate(null);
    setFormData({ name: '', bio: '', photoUrl: '' });
    setIsCreateOpen(true);
  };

  const openEdit = (candidate: ExtendedCandidate) => {
    if (isLocked) return;
    setEditingCandidate(candidate);
    setFormData({
        name: candidate.name,
        bio: candidate.bio || '',
        photoUrl: candidate.photoUrl || ''
    });
    setIsCreateOpen(true);
  };

  if (user && !isAdmin) return <Navigate to="/" replace />;
  if (!user) return null;
  if (!electionId) return <Navigate to="/admin/elections" replace />;

  return (
    <div className="space-y-6 pb-8">
      {/* 這頁是從「選舉管理」進來的，返回也回到那裡，而不是後台總覽 */}
      <PageHeader
        title={isLoadingElection ? '載入中…' : (election?.name ?? '候選人管理')}
        description="管理這場選舉的候選人名單與簡介。"
        back="/admin/elections"
        backLabel="選舉管理"
        actions={
          !isLocked && (
            <Button icon={<Plus className="h-5 w-5" />} onClick={openCreate}>
              新增候選人
            </Button>
          )
        }
      />

      {isLocked && (
        <Notice tone="warning" icon={Lock} title="名單已凍結">
          本場選舉已開始或已結束。為維護公平性，候選人資料已鎖定，無法新增、修改或刪除。
        </Notice>
      )}

      {isLoadingCandidates ? (
        <div role="status" aria-label="載入候選人中" className="space-y-px overflow-hidden rounded-3xl">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-[88px] rounded-none" />)}
        </div>
      ) : candidates.length === 0 ? (
        <EmptyState
          icon={UserCircle}
          title="目前沒有候選人"
          description={isLocked ? '名單已凍結，無法再新增候選人。' : '新增候選人後，選民就能在投票頁看到他們的姓名與簡介。'}
          action={
            !isLocked && (
              <Button icon={<Plus className="h-5 w-5" />} onClick={openCreate}>
                新增候選人
              </Button>
            )
          }
        />
      ) : (
        <Section title="候選人" description={`共 ${candidates.length} 位`} card={false}>
          <ul className="stagger list-none divide-y divide-[var(--color-outline-variant)] overflow-hidden rounded-3xl bg-[var(--color-surface-container-lowest)] p-0">
            {candidates.map((candidate) => (
              <li key={candidate.id} className="flex items-start gap-4 px-4 py-4 md:px-5">
                <CandidateAvatar name={candidate.name} photoUrl={candidate.photoUrl} />

                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="type-title-small text-[var(--color-on-surface)]">{candidate.name}</p>
                  <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-[var(--color-on-surface-variant)]">
                    {candidate.bio || '尚未提供簡介。'}
                  </p>
                </div>

                {/* 編輯與刪除一直顯示：觸控裝置沒有 hover，藏起來的按鈕在手機上等於不存在 */}
                {!isLocked && (
                  <div className="-mr-1 flex shrink-0 items-center gap-0.5">
                    <IconButton aria-label={`編輯候選人「${candidate.name}」`} onClick={() => openEdit(candidate)}>
                      <Pencil aria-hidden="true" />
                    </IconButton>
                    <IconButton tone="error" aria-label={`刪除候選人「${candidate.name}」`} onClick={() => setDeleteTarget(candidate)}>
                      <Trash2 aria-hidden="true" />
                    </IconButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={editingCandidate ? '編輯候選人' : '新增候選人'}
        className="w-full max-w-xl"
        actions={
            <>
                <Button variant="text" onClick={() => setIsCreateOpen(false)}>
                    取消
                </Button>
                <Button
                    onClick={handleSubmit}
                    loading={createMutation.isPending || updateMutation.isPending}
                >
                    儲存
                </Button>
            </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5 py-1">
            <TextField
                label="候選人姓名"
                placeholder="請輸入姓名"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                required
            />

            <TextField
                label="照片網址（選填）"
                value={formData.photoUrl}
                onChange={e => setFormData({...formData, photoUrl: e.target.value})}
                placeholder="https://"
                helperText="請提供公開且有效的圖片連結"
                endAdornment={<ImageIcon className="h-4 w-4" />}
            />

            <TextField
                label="簡介／政見"
                placeholder="請輸入政見或自我介紹"
                value={formData.bio}
                onChange={e => setFormData({...formData, bio: e.target.value})}
                multiline
                rows={6}
            />
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        tone="destructive"
        title="刪除候選人"
        confirmLabel="刪除候選人"
        loading={deleteMutation.isPending}
        description={
          <>
            將永久刪除候選人「{deleteTarget?.name}」，包含其簡介與照片連結。此操作無法復原。
          </>
        }
      />
    </div>
  );
}
