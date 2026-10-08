import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../auth/services/auth.api';
import { TallyResultsBoard, AdminSummaryResponse } from '../../../components/TallyResultsBoard';
import { Button, ButtonLink } from '../../../components/m3/Button';
import { Hourglass, AlertCircle, ChevronLeft, SearchX, RotateCw } from 'lucide-react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';

const ResultsSkeleton = () => (
  <div role="status" aria-label="載入計票結果中" className="space-y-6">
    <div className="skeleton h-40 rounded-3xl" />
    <div className="skeleton h-28 rounded-3xl" />
    <div className="skeleton h-56 rounded-3xl" />
  </div>
);

const backToList = (
  <ButtonLink to="/" variant="tonal" icon={<ChevronLeft className="h-4 w-4" />}>
    返回選舉列表
  </ButtonLink>
);

export function PublicResultsPage() {
  const { electionId } = useParams<{ electionId: string }>();

  const { data: summary, error, isLoading, refetch, isFetching } = useQuery<AdminSummaryResponse>({
    queryKey: ['public-results', electionId],
    queryFn: async () => {
      if (!electionId) throw new Error('No election ID');
      const res = await api.get<AdminSummaryResponse>(`/elections/${electionId}/results`);
      return res.data;
    },
    enabled: !!electionId,
    retry: false, // 403（尚未公布）不該一直重試
  });

  const status = (error as { response?: { status?: number } } | null)?.response?.status;

  const electionName = (summary as { election?: { name?: string } } | undefined)?.election?.name;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <PageHeader
        title="開票結果"
        description={electionName ?? '以下為選舉委員會公布的正式計票結果。'}
        back="/"
        backLabel="選舉列表"
      />

      {isLoading ? (
        <ResultsSkeleton />
      ) : status === 403 ? (
        <EmptyState
          tone="warning"
          icon={Hourglass}
          title="結果尚未公布"
          description="目前仍在計票階段，或尚未開放查詢。正式結果公布後，本頁會直接顯示完整計票資料。"
          action={
            <Button variant="outlined" loading={isFetching} icon={<RotateCw className="h-4 w-4" />} onClick={() => refetch()}>
              重新查詢
            </Button>
          }
        />
      ) : status === 404 ? (
        <EmptyState icon={SearchX} title="找不到這場選舉" description="連結可能已失效，或該場選舉已被移除。" action={backToList} />
      ) : error ? (
        <EmptyState
          tone="error"
          icon={AlertCircle}
          title="無法載入計票結果"
          description="請確認網路連線後再試一次。若問題持續，請聯繫學生會選舉委員會。"
          action={
            <Button variant="outlined" loading={isFetching} icon={<RotateCw className="h-4 w-4" />} onClick={() => refetch()}>
              重新載入
            </Button>
          }
        />
      ) : summary?.tally ? (
        <TallyResultsBoard summary={summary} />
      ) : (
        <EmptyState icon={SearchX} title="尚無計票資料" description="這場選舉目前沒有可顯示的計票結果。" action={backToList} />
      )}
    </div>
  );
}
