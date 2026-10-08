// components/TallyResultsBoard.tsx
import { BarChart3, Trophy, Gavel, Check } from 'lucide-react';
import { Section } from './ui/Section';
import { IconTile } from './ui/IconTile';
import { EmptyState } from './ui/EmptyState';
import { StatusBadge } from './ui/StatusBadge';
import type { Candidate } from '@savote/shared-types';
import { cn } from '../lib/utils';

export interface VoteServiceTally {
  tally: Record<string, number>;
  totalVotes: number;
  blankVotes?: number;
  invalidVotes?: number;
  totalEligibleVoters: number;
  candidates: (Candidate & { voteCount: number })[];
  result: {
    winners?: Candidate[];
    winner?: Candidate; // 為了相容舊版
    threshold?: number;
    note?: string;
    isElected?: boolean;
  };
}

export interface AdminSummaryResponse {
  totalVotes: number;
  tally: VoteServiceTally;
}

interface Props {
  summary: AdminSummaryResponse;
}

/** 統計格：數字是主角，標籤退到次要 */
const Stat = ({
  label,
  value,
  suffix,
  alert = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  alert?: boolean;
}) => (
  <div className="bg-[var(--color-surface-container-lowest)] px-5 py-4">
    <dt className="text-[13px] text-[var(--color-on-surface-variant)]">{label}</dt>
    <dd className="mt-1 flex items-baseline gap-1">
      <span
        className={cn(
          'tabular text-2xl font-bold leading-none tracking-tight md:text-[28px]',
          alert ? 'text-[var(--color-error)]' : 'text-[var(--color-on-surface)]',
        )}
      >
        {value}
      </span>
      {suffix && <span className="text-[13px] text-[var(--color-on-surface-variant)]">{suffix}</span>}
    </dd>
  </div>
);

const fmt = (n: number) => n.toLocaleString('en-US');

export function TallyResultsBoard({ summary }: Props) {
  if (!summary || !summary.tally) return null;

  const { tally } = summary;
  const eligible = tally.totalEligibleVoters || 0;
  const blank = tally.blankVotes || 0;
  const invalid = tally.invalidVotes || 0;

  // 資料不一致時（例如選舉人名單事後被改動）比率可能超過 100%，夾住避免長條溢出
  const turnout = eligible > 0 ? Math.min(100, (summary.totalVotes / eligible) * 100) : 0;

  const winnerIds = new Set(
    [tally.result.winner?.id, ...(tally.result.winners ?? []).map((w) => w.id)].filter(
      Boolean,
    ) as string[],
  );

  // 原本直接對 summary.tally.candidates 呼叫 .sort()，那會就地改動
  // React Query 的快取陣列 —— 快取資料必須視為唯讀，先複製再排序。
  const ranked = [...(tally.candidates ?? [])].sort((a, b) => b.voteCount - a.voteCount);

  return (
    <div className="space-y-6">
      {/* ── 總覽數據 ───────────────────────────────────────────── */}
      <Section title="計票總覽" card={false}>
        <div className="overflow-hidden rounded-3xl bg-[var(--color-surface-container-lowest)]">
          <dl className="grid grid-cols-2 gap-px bg-[var(--color-outline-variant)] lg:grid-cols-4">
            <Stat label="總投票數" value={fmt(summary.totalVotes)} suffix="票" />
            <Stat label="合格選舉人數" value={fmt(eligible)} suffix="人" />
            <Stat label="廢票" value={fmt(blank)} suffix="票" />
            <Stat label="不合法票" value={fmt(invalid)} suffix="票" alert={invalid > 0} />
          </dl>

          {/* 投票率 */}
          <div className="space-y-2 border-t border-[var(--color-outline-variant)] px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-[var(--color-on-surface-variant)]">投票參與率</span>
              <span className="tabular text-[15px] font-semibold text-[var(--color-on-surface)]">
                {turnout.toFixed(2)}%
                <span className="ml-2 font-normal text-[var(--color-on-surface-variant)]">
                  {fmt(summary.totalVotes)} / {fmt(eligible)}
                </span>
              </span>
            </div>
            <div
              role="meter"
              aria-label="投票參與率"
              aria-valuenow={Number(turnout.toFixed(2))}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-container-high)]"
            >
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-[var(--dur-page)] ease-[var(--ease-standard)]"
                style={{ width: `${turnout}%` }}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* ── 當選認定 ───────────────────────────────────────────── */}
      <Section
        title="當選認定"
        description="依「國立彰化師範大學學生會選舉罷免暨推舉自治條例」規定"
        bodyClassName="p-0"
      >
        <div className="flex items-start gap-3.5 px-5 py-4">
          <IconTile icon={Gavel} tone="neutral" size="sm" />
          <p className="pt-1.5 text-[15px] font-semibold leading-relaxed text-[var(--color-on-surface)]">
            {tally.result.note || '計票結果尚在核對中'}
          </p>
        </div>
        {typeof tally.result.threshold === 'number' && (
          <div className="flex items-center justify-between border-t border-[var(--color-outline-variant)] px-5 py-3.5 text-[15px]">
            <span className="text-[var(--color-on-surface-variant)]">法定當選門檻</span>
            <span className="tabular font-semibold text-[var(--color-on-surface)]">{fmt(tally.result.threshold)} 票</span>
          </div>
        )}
      </Section>

      {/* ── 各候選人得票 ───────────────────────────────────────── */}
      <Section
        title="各候選人得票"
        description={`百分比以總投票數 ${fmt(summary.totalVotes)} 票為分母，已包含廢票與不合法票。`}
        card={false}
      >
        {ranked.length === 0 ? (
          <EmptyState icon={BarChart3} title="尚無有效的計票資料" />
        ) : (
          <ol className="list-none divide-y divide-[var(--color-outline-variant)] overflow-hidden rounded-3xl bg-[var(--color-surface-container-lowest)] p-0">
            {ranked.map((candidate, index) => {
              const count = candidate.voteCount;
              const percentage = summary.totalVotes > 0 ? (count / summary.totalVotes) * 100 : 0;
              const isWinner = winnerIds.has(candidate.id);

              return (
                <li key={candidate.id} className="space-y-3 px-5 py-4">
                  <div className="flex items-center gap-3.5">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px] font-semibold',
                        isWinner
                          ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                          : 'bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]',
                      )}
                    >
                      {isWinner ? <Trophy className="h-[18px] w-[18px]" /> : index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* 當選不只靠顏色標示：同時有獎盃圖示與「當選」文字 */}
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="type-title-medium text-[var(--color-on-surface)]">{candidate.name}</span>
                        {isWinner && <StatusBadge tone="info" icon={Check}>當選</StatusBadge>}
                      </p>
                      {candidate.bio && (
                        <p className="mt-0.5 line-clamp-1 text-[13px] text-[var(--color-on-surface-variant)]">{candidate.bio}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular text-xl font-bold leading-none text-[var(--color-on-surface)]">
                        {fmt(count)}
                        <span className="ml-0.5 text-[13px] font-normal text-[var(--color-on-surface-variant)]">票</span>
                      </p>
                      <p className="tabular mt-1 text-[13px] text-[var(--color-on-surface-variant)]">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div
                    role="meter"
                    aria-label={`${candidate.name} 得票比率`}
                    aria-valuenow={Number(percentage.toFixed(1))}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-container-high)]"
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width] duration-[var(--dur-page)] ease-[var(--ease-standard)]',
                        isWinner ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-outline)]',
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Section>
    </div>
  );
}
