import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Election, EligibleVoter } from "@savote/shared-types";
import { API_ENDPOINTS } from "../../../lib/constants";
import { api } from "../../auth/services/auth.api";
import {
  voterApi,
  type ImportVotersResponse,
} from "../../auth/services/voter.api";
import { Button } from "../../../components/m3/Button";
import {
  Upload,
  Download,
  FileText,
  Users,
  Fingerprint,
  Lock as LockIcon,
} from "lucide-react";
import axios from "axios";
import { cn } from '../../../lib/utils';
import { formatNumber } from '../../../lib/datetime';
import { Section } from '../../../components/ui/Section';
import { Select } from '../../../components/ui/Select';
import { SearchField } from '../../../components/ui/SearchField';
import { Notice } from '../../../components/ui/Notice';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { IconTile } from '../../../components/ui/IconTile';

interface StatusState {
  type: "idle" | "success" | "error";
  message?: string;
  result?: ImportVotersResponse;
}

// 一場選舉的名冊可能有上千人。一次全部畫出來，手機會卡；先顯示一段，需要再展開。
const PAGE_SIZE = 200;

export function VoterImport() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedElectionId, setSelectedElectionId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusState>({ type: "idle" });
  const [voterSearch, setVoterSearch] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // 1. Fetch Elections
  const { data: elections = [] } = useQuery({
    queryKey: ["admin", "elections", "visible"], // 與選舉管理的「全部選舉」分開快取，避免互相覆蓋
    queryFn: async () => {
      const response = await api.get<Election[]>(API_ENDPOINTS.ELECTIONS.LIST);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2. Fetch Voter List for selected election
  const {
    data: voters = [],
    isLoading: isLoadingVoters,
    refetch: refetchVoters,
  } = useQuery({
    queryKey: ["admin", "voters", selectedElectionId],
    queryFn: async () => {
      if (!selectedElectionId) return [];
      const response = await api.get<EligibleVoter[]>(
        `${API_ENDPOINTS.ELECTIONS.CREATE}/${selectedElectionId}/voters`,
      );
      return response.data;
    },
    enabled: !!selectedElectionId,
  });

  useEffect(() => {
    if (!selectedElectionId && elections.length > 0) {
      setSelectedElectionId(elections[0].id);
    }
  }, [elections, selectedElectionId]);

  // 換選舉或換關鍵字時，清單回到第一段
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedElectionId, voterSearch]);

  const importMutation = useMutation({
    mutationFn: ({ electionId, file }: { electionId: string; file: File }) =>
      voterApi.importVoters({ electionId, file }),
    onSuccess: (result) => {
      setStatus({ type: "success", result });
      setSelectedFile(null);
      refetchVoters();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error: unknown) => {
      let message = "匯入失敗";
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        const apiMessage = (error.response.data as any).message;
        message = Array.isArray(apiMessage) ? apiMessage.join(", ") : apiMessage;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setStatus({ type: "error", message });
    },
  });

  const isSubmitDisabled = useMemo(() => {
    const election = elections.find((e) => e.id === selectedElectionId);
    const isLocked = election?.startTime
      ? new Date() >= new Date(election.startTime)
      : false;
    return (
      !selectedElectionId ||
      !selectedFile ||
      importMutation.isPending ||
      isLocked
    );
  }, [selectedElectionId, selectedFile, importMutation.isPending, elections]);

  const filteredVoters = voters.filter(
    (v) =>
      v.studentId.toLowerCase().includes(voterSearch.toLowerCase()) ||
      v.class.toLowerCase().includes(voterSearch.toLowerCase()),
  );
  const registeredCount = voters.filter((v) => v.identityCommitment).length;

  /** 共用的檔案採用流程：先擋掉明顯不是 CSV 的檔案，避免白跑一趟上傳 */
  const acceptFile = (file: File | null) => {
    if (!file) return;
    const looksLikeCsv =
      file.type === "text/csv" ||
      file.type === "application/vnd.ms-excel" ||
      file.name.toLowerCase().endsWith(".csv");
    if (!looksLikeCsv) {
      setSelectedFile(null);
      setStatus({ type: "error", message: `「${file.name}」不是 CSV 檔案，請改用 .csv 格式。` });
      return;
    }
    setSelectedFile(file);
    setStatus({ type: "idle" });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0] ?? null);
  };

  // 原本的文案寫「點擊或拖曳」，但完全沒有實作拖放處理器 —— 拖進去不會有任何反應
  const handleDragOver = (e: React.DragEvent) => {
    if (isElectionLocked) return;
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isElectionLocked) return;
    acceptFile(e.dataTransfer.files?.[0] ?? null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedElectionId || !selectedFile) {
      setStatus({ type: "error", message: "請選擇選舉與 CSV 檔案。" });
      return;
    }
    importMutation.mutate({
      electionId: selectedElectionId,
      file: selectedFile,
    });
  };

  const handleDownloadTemplate = () => {
    const content = "studID\nS1354000\nS1353000";
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "savote-voters.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectedElection = elections.find((e) => e.id === selectedElectionId);
  const isElectionLocked = selectedElection?.startTime
    ? new Date() >= new Date(selectedElection.startTime)
    : false;

  const shownVoters = filteredVoters.slice(0, visibleCount);

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      {/* ── 匯入 ─────────────────────────────────────────────── */}
      <Section
        className="lg:sticky lg:top-24 lg:col-span-5"
        title="匯入名冊"
        actions={
          <Button
            variant="text"
            size="sm"
            onClick={handleDownloadTemplate}
            icon={<Download className="h-4 w-4" />}
          >
            下載範本
          </Button>
        }
      >
        <div className="space-y-5">
          <Select
            label="選舉"
            value={selectedElectionId}
            onChange={(e) => setSelectedElectionId(e.target.value)}
          >
            {elections.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>

          {isElectionLocked ? (
            <Notice tone="warning" icon={LockIcon} title="名單已凍結">
              此選舉已開始投票，依選務規則無法再匯入或修改名冊。
            </Notice>
          ) : (
            <>
              {/* 真的 <button>：原本是 <div onClick>，鍵盤與螢幕閱讀器使用者
                  完全無法選擇檔案。拖放另外由 onDrop 處理。 */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                aria-label={
                  selectedFile
                    ? `已選擇檔案 ${selectedFile.name}，點擊可重新選擇`
                    : "選擇或拖曳 CSV 名冊檔案"
                }
                className={cn(
                  "focus-ring flex w-full items-center gap-4 rounded-2xl p-4 text-left",
                  "transition-[background-color,box-shadow] duration-[var(--dur-control)]",
                  isDragging
                    ? "bg-[var(--color-primary-container)] ring-2 ring-[var(--color-primary)]"
                    : "bg-[var(--color-surface-container)] hover:bg-[var(--color-surface-container-high)]",
                )}
              >
                <IconTile icon={selectedFile ? FileText : Upload} tone={selectedFile || isDragging ? 'primary' : 'neutral'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-[var(--color-on-surface)]">
                    {isDragging
                      ? "放開以選擇這個檔案"
                      : selectedFile
                        ? selectedFile.name
                        : "選擇 CSV 檔案"}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-[var(--color-on-surface-variant)]">
                    {selectedFile
                      ? `${(selectedFile.size / 1024).toFixed(1)} KB · 點擊可重新選擇`
                      : "點擊選擇，或將檔案拖曳到這裡。第一欄為學號。"}
                  </span>
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
              />

              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                loading={importMutation.isPending}
                className="w-full"
                icon={<Upload className="h-5 w-5" />}
              >
                匯入名冊
              </Button>
            </>
          )}

          {status.type !== "idle" && (
            <Notice
              tone={status.type === "success" ? "success" : "error"}
              title={status.type === "success" ? "匯入完成" : "匯入失敗"}
            >
              <span className="break-words">
                {status.type === "success"
                  ? `成功匯入 ${status.result?.votersImported} 筆，略過重複 ${status.result?.duplicatesSkipped} 筆。`
                  : status.message}
              </span>
            </Notice>
          )}
        </div>
      </Section>

      {/* ── 名單 ─────────────────────────────────────────────── */}
      <Section
        className="lg:col-span-7"
        title="選舉人名單"
        description={
          isLoadingVoters || voters.length === 0
            ? undefined
            : `共 ${formatNumber(voters.length)} 人，已登記投票金鑰 ${formatNumber(registeredCount)} 人`
        }
        card={false}
      >
        {voters.length > 0 && (
          <SearchField value={voterSearch} onChange={setVoterSearch} placeholder="搜尋學號或班級" />
        )}

        {isLoadingVoters ? (
          <div role="status" aria-label="載入名單中" className="space-y-px overflow-hidden rounded-3xl">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-[60px] rounded-none" />)}
          </div>
        ) : voters.length === 0 ? (
          <EmptyState
            icon={Users}
            title="尚未匯入選舉人"
            description="上傳 CSV 名冊後，名單會出現在這裡。"
          />
        ) : filteredVoters.length === 0 ? (
          <EmptyState
            icon={Users}
            title="沒有符合的選舉人"
            description="試試其他學號或班級，或清除搜尋條件。"
          />
        ) : (
          <>
            <ul className="list-none divide-y divide-[var(--color-outline-variant)] overflow-hidden rounded-3xl bg-[var(--color-surface-container-lowest)] p-0">
              {shownVoters.map((voter) => (
                <li key={voter.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="tabular truncate text-[15px] font-medium text-[var(--color-on-surface)]">
                      {voter.studentId}
                    </p>
                    <p className="truncate text-[13px] text-[var(--color-on-surface-variant)]">{voter.class}</p>
                  </div>
                  {voter.identityCommitment ? (
                    <StatusBadge tone="success" icon={Fingerprint}>已登記</StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral" icon={null}>未登記</StatusBadge>
                  )}
                </li>
              ))}
            </ul>

            {filteredVoters.length > visibleCount && (
              <div className="flex flex-col items-center gap-2 pt-1">
                <p className="text-[13px] text-[var(--color-on-surface-variant)]">
                  已顯示 {formatNumber(visibleCount)}／{formatNumber(filteredVoters.length)} 人
                </p>
                <Button variant="outlined" size="sm" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
                  顯示更多
                </Button>
              </div>
            )}
          </>
        )}
      </Section>
    </div>
  );
}
