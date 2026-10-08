import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../auth/services/auth.api';
import { API_ENDPOINTS } from '../../../lib/constants';
import { type Election, ElectionType } from '@savote/shared-types';
import { Button, ButtonLink } from '../../../components/m3/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { AlertCircle, Vote, Timer, Check, BarChart3, RotateCw, Inbox, FileText } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { formatDateTime, formatRemaining } from '../../../lib/datetime';
import { PageHeader } from '../../../components/ui/PageHeader';
import { StatusBadge, type StatusTone } from '../../../components/ui/StatusBadge';

export const ELECTION_TYPE_LABELS: Record<string, string> = {
    [ElectionType.PRESIDENTIAL]: '正副會長選舉',
    [ElectionType.DISTRICT_COUNCILOR]: '選區議員選舉',
    [ElectionType.AT_LARGE_COUNCILOR]: '不分區議員選舉',
};

type StatusKey = 'draft' | 'upcoming' | 'active' | 'finished';

interface StatusInfo {
    key: StatusKey;
    label: string;
    tone: StatusTone;
    icon: React.ElementType;
    started: boolean;
}

/**
 * 狀態不只靠顏色傳達（WCAG 1.4.1）：
 * 每個狀態都有不同的「圖示形狀 + 文字 + 卡片表面層級」，
 * 色盲使用者不看顏色也能分辨。
 */
const getStatusInfo = (start: Date | null, end: Date | null, now: number): StatusInfo => {
    if (!start || !end)
        return {
            key: 'draft',
            label: '準備中',
            tone: 'neutral',
            icon: Timer,
            started: false,
        };

    if (now < start.getTime())
        return {
            key: 'upcoming',
            label: '即將開始',
            tone: 'warning',
            icon: Timer,
            started: false,
        };

    if (now <= end.getTime())
        return {
            key: 'active',
            label: '投票進行中',
            tone: 'success',
            icon: Vote,
            started: true,
        };

    return {
        key: 'finished',
        label: '已結束',
        tone: 'neutral',
        icon: Check,
        started: true,
    };
};

const ElectionCardSkeleton = () => (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-[var(--color-surface-container-lowest)]">
        <div className="flex-1 space-y-4 p-6">
            <div className="skeleton h-6 w-28 rounded-full" />
            <div className="skeleton h-6 w-4/5" />
            <div className="skeleton h-16 w-full rounded-2xl" />
            <div className="skeleton h-[52px] w-full rounded-full" />
        </div>
    </div>
);

export const HomePage = () => {
    const { data: elections = [], isLoading, isError, refetch } = useQuery({
        queryKey: ['elections'],
        queryFn: async () => {
            const response = await api.get<Election[]>(API_ENDPOINTS.ELECTIONS.LIST);
            return response.data;
        },
    });

    // 倒數需要隨時間前進。每 30 秒推一次就夠了 —— 不需要每秒重繪整個列表。
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="space-y-6 pb-8">
            <PageHeader
                title="選舉列表"
                description="歡迎參與校園民主。請在下方選擇選舉項目，查看詳情或進行投票。"
            />

            {isLoading ? (
                <div role="status" aria-label="載入選舉列表中" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <ElectionCardSkeleton />
                    <ElectionCardSkeleton />
                    <ElectionCardSkeleton />
                </div>
            ) : isError ? (
                <EmptyState
                    tone="error"
                    icon={AlertCircle}
                    title="無法載入選舉列表"
                    description="請確認網路連線後再試一次。若問題持續，請聯繫學生會選舉委員會。"
                    action={
                        <Button variant="outlined" icon={<RotateCw className="h-4 w-4" />} onClick={() => refetch()}>
                            重新載入
                        </Button>
                    }
                />
            ) : elections.length === 0 ? (
                <EmptyState
                    icon={Inbox}
                    title="目前沒有開放中的選舉"
                    description="選舉開放時會公告於學生會各社群平台。您也可以先查看選舉公報了解候選人資訊。"
                    action={
                        <ButtonLink to="/info/bulletin" variant="outlined" icon={<FileText className="h-4 w-4" />}>
                            查看選舉公報
                        </ButtonLink>
                    }
                />
            ) : (
                <ul className="stagger grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {elections.map((election) => {
                        const start = election.startTime ? new Date(election.startTime) : null;
                        const end = election.endTime ? new Date(election.endTime) : null;
                        const status = getStatusInfo(start, end, now);
                        const description = (election as { description?: string }).description;

                        const remaining =
                            status.key === 'active' && end
                                ? formatRemaining(end.getTime() - now)
                                : status.key === 'upcoming' && start
                                  ? formatRemaining(start.getTime() - now)
                                  : null;

                        const when = status.started ? end : start;

                        return (
                            <li key={election.id} className="flex">
                                <article className="flex w-full flex-col rounded-3xl bg-[var(--color-surface-container-lowest)] p-5 md:p-6">
                                    <div className="flex items-center justify-between gap-3">
                                        <StatusBadge tone={status.tone} icon={status.icon} pulse={status.key === 'active'}>
                                            {status.label}
                                        </StatusBadge>
                                        <span className="truncate text-[13px] text-[var(--color-on-surface-variant)]">
                                            {ELECTION_TYPE_LABELS[election.type] || election.type}
                                        </span>
                                    </div>

                                    <h2
                                        className="type-title-large mt-4 line-clamp-2 text-[var(--color-on-surface)]"
                                        title={election.name}
                                    >
                                        {election.name}
                                    </h2>

                                    {description && (
                                        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[var(--color-on-surface-variant)]">
                                            {description}
                                        </p>
                                    )}

                                    {/* 時間資訊：卡片內的灰色區塊，兩欄對齊 */}
                                    <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[var(--color-outline-variant)] text-sm">
                                        <div className={cn('bg-[var(--color-surface-container)] px-4 py-3', !remaining && 'col-span-2')}>
                                            <dt className="text-xs text-[var(--color-on-surface-variant)]">
                                                {status.started ? '截止時間' : '開始時間'}
                                            </dt>
                                            <dd className="tabular mt-0.5 font-semibold text-[var(--color-on-surface)]">
                                                {when ? formatDateTime(when) : '—'}
                                            </dd>
                                        </div>
                                        {remaining && (
                                            <div className="bg-[var(--color-surface-container)] px-4 py-3">
                                                <dt className="text-xs text-[var(--color-on-surface-variant)]">
                                                    {status.key === 'active' ? '距離截止' : '距離開始'}
                                                </dt>
                                                <dd className="tabular mt-0.5 font-semibold text-[var(--color-on-surface)]">
                                                    {remaining}
                                                </dd>
                                            </div>
                                        )}
                                    </dl>

                                    <div className="mt-5 flex flex-1 flex-col justify-end gap-2">
                                        {status.key === 'active' ? (
                                            <ButtonLink to={`/vote/${election.id}`} size="lg" className="w-full" icon={<Vote className="h-5 w-5" />}>
                                                進入投票所
                                            </ButtonLink>
                                        ) : status.key !== 'finished' ? (
                                            <Button disabled size="lg" className="w-full" icon={<Timer className="h-5 w-5" />}>
                                                尚未開放投票
                                            </Button>
                                        ) : null}

                                        {status.started && (
                                            <ButtonLink
                                                to={`/${election.id}/results`}
                                                variant={status.key === 'finished' ? 'tonal' : 'outlined'}
                                                size="lg"
                                                className="w-full"
                                                icon={<BarChart3 className="h-5 w-5" />}
                                            >
                                                查看開票結果
                                            </ButtonLink>
                                        )}
                                    </div>
                                </article>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};
