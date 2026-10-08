import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../auth/services/auth.api';
import { candidateApi } from '../../auth/services/candidate.api';
import { API_ENDPOINTS } from '../../../lib/constants';
import type { Election } from '@savote/shared-types';
import { Button } from '../../../components/m3/Button';
import { TextField } from '../../../components/m3/TextField';
import { Trash2, Plus, UserCircle, Upload } from 'lucide-react';
import { Section } from '../../../components/ui/Section';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/ui/EmptyState';
import { IconButton } from '../../../components/ui/IconButton';

// 目前沒有任何頁面使用這個元件（候選人改在 CandidateManagementPage 管理），
// 外觀仍跟上系統，避免日後被重新引用時又帶回舊的樣式。
export function CandidateManager() {
  const queryClient = useQueryClient();
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [newCandidate, setNewCandidate] = useState<{ name: string; bio: string; photoFile: File | null }>({ name: '', bio: '', photoFile: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Elections
  const { data: elections = [], isLoading: isLoadingElections } = useQuery({
    queryKey: ['admin', 'elections', 'visible'],
    queryFn: async () => {
      const response = await api.get<Election[]>(API_ENDPOINTS.ELECTIONS.LIST);
      return response.data;
    },
  });

  useEffect(() => {
    if (!selectedElectionId && elections.length > 0) {
      setSelectedElectionId(elections[0].id);
    }
  }, [elections, selectedElectionId]);

  // Fetch Candidates
  const { data: candidates = [], isLoading: isLoadingCandidates } = useQuery({
    queryKey: ['admin', 'candidates', selectedElectionId],
    queryFn: () => candidateApi.findAll(selectedElectionId),
    enabled: !!selectedElectionId,
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (data: FormData) => candidateApi.create(selectedElectionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'candidates', selectedElectionId] });
      setNewCandidate({ name: '', bio: '', photoFile: null });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => candidateApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'candidates', selectedElectionId] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCandidate.name) return;

    const formData = new FormData();
    formData.append('name', newCandidate.name);
    formData.append('bio', newCandidate.bio);
    if (newCandidate.photoFile) {
        formData.append('photo', newCandidate.photoFile);
    }

    createMutation.mutate(formData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setNewCandidate({ ...newCandidate, photoFile: e.target.files[0] });
    }
  };

  return (
    <div className="space-y-6">
      <Section title="候選人管理">
        <div className="space-y-5">
          {isLoadingElections ? (
            <div className="skeleton h-12 rounded-xl" />
          ) : (
            <Select
              label="選舉"
              value={selectedElectionId}
              onChange={(e) => setSelectedElectionId(e.target.value)}
            >
              {elections.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          )}

          <form onSubmit={handleCreate} className="space-y-4 rounded-2xl bg-[var(--color-surface-container)] p-4">
            <h3 className="type-title-small text-[var(--color-on-surface)]">新增候選人</h3>
            <TextField
              label="姓名"
              value={newCandidate.name}
              onChange={e => setNewCandidate({ ...newCandidate, name: e.target.value })}
            />
            <TextField
              label="簡介"
              value={newCandidate.bio}
              onChange={e => setNewCandidate({ ...newCandidate, bio: e.target.value })}
            />

            <div className="space-y-1.5">
              {/* file input 是隱藏的、由下方按鈕代觸發，
                  所以這裡用 <span> 當區塊標題，真正的可及名稱放在按鈕上 */}
              <span className="block px-1 text-sm font-semibold text-[var(--color-on-surface)]">照片</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                  id="photo-upload"
                />
                <Button
                  variant="outlined"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  icon={<Upload className="h-4 w-4" />}
                >
                  {newCandidate.photoFile ? newCandidate.photoFile.name : '上傳照片'}
                </Button>
                {newCandidate.photoFile && (
                  <Button
                    variant="text"
                    color="error"
                    size="sm"
                    onClick={() => {
                      setNewCandidate({ ...newCandidate, photoFile: null });
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    清除
                  </Button>
                )}
              </div>
            </div>

            <Button
              type="submit"
              disabled={createMutation.isPending || !selectedElectionId}
              loading={createMutation.isPending}
              icon={<Plus className="h-4 w-4" />}
            >
              新增
            </Button>
          </form>
        </div>
      </Section>

      <Section title="候選人" card={false}>
        {isLoadingCandidates ? (
          <div className="space-y-px overflow-hidden rounded-3xl">
            {[1, 2].map((i) => <div key={i} className="skeleton h-[68px] rounded-none" />)}
          </div>
        ) : candidates.length === 0 ? (
          <EmptyState icon={UserCircle} title="尚無候選人" />
        ) : (
          <ul className="list-none divide-y divide-[var(--color-outline-variant)] overflow-hidden rounded-3xl bg-[var(--color-surface-container-lowest)] p-0">
            {candidates.map(candidate => (
              <li key={candidate.id} className="flex items-center gap-4 px-4 py-3 md:px-5">
                {candidate.photoUrl ? (
                  <img src={candidate.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-2xl bg-[var(--color-surface-container)] object-cover" />
                ) : (
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)]">
                    <UserCircle className="h-6 w-6" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="type-title-small truncate text-[var(--color-on-surface)]">{candidate.name}</p>
                  {candidate.bio && (
                    <p className="truncate text-[13px] text-[var(--color-on-surface-variant)]">{candidate.bio}</p>
                  )}
                </div>
                <IconButton
                  tone="error"
                  aria-label={`刪除候選人「${candidate.name}」`}
                  onClick={() => deleteMutation.mutate(candidate.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
