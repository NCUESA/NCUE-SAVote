import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/hooks/useAuth";
import { api } from "../../auth/services/auth.api";
import { API_ENDPOINTS } from "../../../lib/constants";
import { Button } from '../../../components/m3/Button';
import { AdminHeader } from '../components/AdminHeader';
import { type Election, type Candidate, UserRole } from "@savote/shared-types";
import { Loader2, RefreshCw, Activity } from "lucide-react";
import { Navigate } from "react-router-dom";
import { TallyResultsBoard } from '../../../components/TallyResultsBoard';
import { formatTime } from '../../../lib/datetime';
import { Section } from '../../../components/ui/Section';
import { Select } from '../../../components/ui/Select';
import { Notice } from '../../../components/ui/Notice';
import { EmptyState } from '../../../components/ui/EmptyState';

interface VoteServiceTally {
    tally: Record<string, number>;
    totalVotes: number;
    totalEligibleVoters: number;
    candidates: (Candidate & { voteCount: number })[];
    result: {
        type?: string;
        winner?: Candidate;
        winners?: Candidate[];
        threshold?: number;
        tie?: boolean;
        note?: string;
        isElected?: boolean;
    };
}

interface AdminSummaryResponse {
  election: Election;
  totalVotes: number;
  tally: VoteServiceTally;
}

export function AdminMonitoringPage() {
  const { user } = useAuth();
  const [selectedElectionId, setSelectedElectionId] = useState<string>("");

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const { data: elections = [], isLoading: isLoadingElections } = useQuery({
    queryKey: ["elections"],
    queryFn: async () => {
      const res = await api.get<Election[]>(API_ENDPOINTS.ELECTIONS.LIST);
      return res.data;
    },
  });

  const { data: summary, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery<AdminSummaryResponse>({
    queryKey: ["admin-summary", selectedElectionId],
    queryFn: async () => {
      if (!selectedElectionId) throw new Error("No election selected");
      const base = API_ENDPOINTS.ELECTIONS.GET(selectedElectionId);
      const res = await api.get<AdminSummaryResponse>(`${base}/admin-summary`);
      return res.data;
    },
    enabled: !!selectedElectionId,
    refetchOnWindowFocus: false,
  });

  if (user && !isAdmin) return <Navigate to="/" replace />;
  if (!user) return null;

  const now = new Date();
  const monitorableElections = elections.filter(
    (e) => e.endTime && now > new Date(e.endTime)
  );

  return (
    <div className="space-y-6 pb-8">
      <AdminHeader
        title="開票監控"
        subtitle="查看已結束選舉的計票統計與當選結果。"
      />

      {!isLoadingElections && monitorableElections.length === 0 ? (
        <Notice tone="neutral" title="目前沒有已結束的選舉">
          選舉的投票時間結束後，才能在這裡查看計票結果。
        </Notice>
      ) : (
        <Section>
          <Select
            label="選舉"
            value={selectedElectionId}
            onChange={(e) => setSelectedElectionId(e.target.value)}
          >
            <option value="">請選擇已結束的選舉</option>
            {monitorableElections.map((election) => (
              <option key={election.id} value={election.id}>
                {election.name}
              </option>
            ))}
          </Select>

          {selectedElectionId && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="tabular text-[13px] text-[var(--color-on-surface-variant)]" aria-live="polite">
                {dataUpdatedAt ? `最後更新 ${formatTime(dataUpdatedAt)}` : '正在取得資料…'}
              </p>
              <Button
                variant="outlined"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                loading={isFetching}
                icon={<RefreshCw className="h-4 w-4" />}
              >
                重新整理
              </Button>
            </div>
          )}
        </Section>
      )}

      {!selectedElectionId && monitorableElections.length > 0 && (
        <EmptyState
          icon={Activity}
          title="選擇一場選舉"
          description="從上方選擇已結束的選舉，即可查看計票統計與當選結果。"
        />
      )}

      {isLoading && selectedElectionId && (
        <div
          role="status"
          className="flex flex-col items-center gap-3 rounded-3xl bg-[var(--color-surface-container-lowest)] py-16 text-center"
        >
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" aria-hidden="true" />
          <p className="text-[15px] text-[var(--color-on-surface-variant)]">正在取得計票結果…</p>
        </div>
      )}

      {summary && summary.tally && (
        <TallyResultsBoard summary={summary} />
      )}
    </div>
  );
}
