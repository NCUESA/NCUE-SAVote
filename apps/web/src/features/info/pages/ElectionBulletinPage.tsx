import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../auth/services/auth.api';
import { API_ENDPOINTS } from '../../../lib/constants';
import { type Election, ElectionType } from '@savote/shared-types';
import { Button, buttonClassName } from '../../../components/m3/Button';
import { FileText, ExternalLink, Info, ChevronRight, ChevronLeft, AlertCircle, Loader2, RotateCw } from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { IconTile } from '../../../components/ui/IconTile';
import { IconButton } from '../../../components/ui/IconButton';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import { cn } from '../../../lib/utils';
import { formatDate } from '../../../lib/datetime';
import { PageHeader } from '../../../components/ui/PageHeader';

export const ELECTION_TYPE_LABELS: Record<string, string> = {
  [ElectionType.PRESIDENTIAL]: '正副會長選舉',
  [ElectionType.DISTRICT_COUNCILOR]: '選區議員選舉',
  [ElectionType.AT_LARGE_COUNCILOR]: '不分區議員選舉',
};


/** Google Drive 的 /view 連結要換成 /preview 才能內嵌；其他網址原樣使用 */
const toEmbedUrl = (url: string) =>
  /drive\.google\.com|docs\.google\.com/.test(url) ? url.replace(/\/view(\?.*)?$/, '/preview') : url;

export function ElectionBulletinPage() {
  const [selected, setSelected] = useState<Election | null>(null);
  const [frameState, setFrameState] = useState<'loading' | 'ready' | 'error'>('loading');
  const { isAuthenticated } = useAuth();

  const { data: elections = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['public', 'elections'],
    queryFn: async () => {
      const response = await api.get<Election[]>(API_ENDPOINTS.ELECTIONS.LIST);
      return response.data;
    },
  });

  const bulletins = elections.filter((e) => (e.config as { bulletinUrl?: string } | null)?.bulletinUrl);

  // 換一份公報就要重新計算載入狀態，否則會沿用上一份的結果
  useEffect(() => {
    if (selected) setFrameState('loading');
  }, [selected?.id]);

  // 內嵌載入失敗（Drive 權限不足、網路被擋）時給一個明確的逾時判定，
  // 否則使用者只會一直看著空白的框。
  useEffect(() => {
    if (!selected || frameState !== 'loading') return;
    const timer = setTimeout(() => setFrameState((s) => (s === 'loading' ? 'error' : s)), 12_000);
    return () => clearTimeout(timer);
  }, [selected?.id, frameState]);

  const bulletinUrl = (selected?.config as { bulletinUrl?: string } | null)?.bulletinUrl ?? '';

  const externalLink = (label: string, variant: 'tonal' | 'outlined' = 'tonal') => (
    // 外部連結用 <a> 套按鈕外觀，不把 <button> 包進 <a>
    <a
      href={bulletinUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClassName({ variant, size: 'sm' })}
    >
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );

  const content = (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="選舉公報"
        description="各場選舉的正式公報。選擇一場選舉即可預覽。"
        back={isAuthenticated ? undefined : '/auth/login'}
        backLabel="登入頁"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        {/* ── 公報列表 ──────────────────────────────────────── */}
        <section aria-label="公報列表" className={cn('min-w-0 space-y-3', selected && 'hidden lg:block')}>
          {isLoading ? (
            <div role="status" aria-label="載入公報列表中" className="skeleton h-48 rounded-3xl" />
          ) : isError ? (
            <EmptyState
              tone="error"
              icon={AlertCircle}
              title="無法載入公報列表"
              description="請確認網路連線後再試一次。"
              action={<Button variant="outlined" icon={<RotateCw className="h-4 w-4" />} onClick={() => refetch()}>重新載入</Button>}
            />
          ) : bulletins.length === 0 ? (
            <EmptyState icon={FileText} title="目前尚無已發布的公報" description="公報發布後會顯示在這裡。" />
          ) : (
            <ul className="list-none divide-y divide-[var(--color-outline-variant)] overflow-hidden rounded-3xl bg-[var(--color-surface-container-lowest)] p-0">
              {bulletins.map((election) => {
                const isSelected = selected?.id === election.id;
                return (
                  <li key={election.id}>
                    {/* 真的 <button>：原本是 <div onClick>，鍵盤使用者完全無法選擇公報 */}
                    <button
                      type="button"
                      onClick={() => setSelected(election)}
                      aria-pressed={isSelected}
                      className={cn(
                        'focus-ring flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-[var(--dur-micro)] md:px-5',
                        isSelected ? 'bg-[var(--color-primary-container)]' : 'hover:bg-[var(--color-on-surface)]/[0.04]',
                      )}
                    >
                      <IconTile icon={FileText} tone={isSelected ? 'primary' : 'neutral'} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="type-title-small block truncate text-[var(--color-on-surface)]">{election.name}</span>
                        <span className="tabular mt-0.5 block truncate text-[13px] text-[var(--color-on-surface-variant)]">
                          {formatDate(election.startTime)} · {ELECTION_TYPE_LABELS[election.type] || election.type}
                        </span>
                      </span>
                      <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--color-outline)]" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── 預覽 ──────────────────────────────────────────── */}
        <section aria-label="公報預覽" className={cn('min-w-0 space-y-3', !selected && 'hidden lg:block')}>
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <IconButton className="-ml-2 lg:hidden" onClick={() => setSelected(null)} aria-label="返回公報列表">
                    <ChevronLeft aria-hidden="true" />
                  </IconButton>
                  <h2 className="type-title-large min-w-0 flex-1 truncate text-[var(--color-on-surface)]">{selected.name}</h2>
                </div>
                {externalLink('新分頁開啟')}
              </div>

              <div className="relative h-[70dvh] overflow-hidden rounded-3xl bg-[var(--color-surface-container-lowest)]">
                {frameState !== 'error' && (
                  <iframe
                    key={selected.id}
                    src={toEmbedUrl(bulletinUrl)}
                    title={`${selected.name} 公報預覽`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onLoad={() => setFrameState('ready')}
                    className="h-full w-full border-none"
                  />
                )}

                {frameState === 'loading' && (
                  <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--color-surface-container-lowest)]">
                    <Loader2 className="h-7 w-7 animate-spin text-[var(--color-primary)]" aria-hidden="true" />
                    <p className="text-sm text-[var(--color-on-surface-variant)]">載入公報中…</p>
                  </div>
                )}

                {frameState === 'error' && (
                  <EmptyState
                    className="h-full justify-center"
                    tone="warning"
                    icon={AlertCircle}
                    title="無法在此預覽這份公報"
                    description="文件可能未開放公開存取，或瀏覽器封鎖了內嵌內容。請改用新分頁開啟。"
                    action={externalLink('在新分頁開啟公報', 'outlined')}
                  />
                )}
              </div>
            </>
          ) : (
            <EmptyState
              className="min-h-[50dvh] justify-center"
              icon={Info}
              title="請選擇一份公報"
              description="從列表中選擇一場選舉，即可在此預覽正式公報。"
            />
          )}
        </section>
      </div>
    </div>
  );

  if (isAuthenticated) return content;

  // 未登入時此頁不在 MainLayout 內：自帶與 MainLayout 相同的頂欄與留白，視覺上是同一個 App
  return (
    <div className="min-h-dvh bg-[var(--color-background)]">
      <header className="glass fixed inset-x-0 top-0 z-40 flex h-[calc(4rem+env(safe-area-inset-top,0px))] items-center rounded-none border-x-0 border-t-0 pt-[env(safe-area-inset-top,0px)] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] md:h-[72px] md:px-6">
        <Link to="/auth/login" className="focus-ring flex min-w-0 items-center gap-3 rounded-2xl">
          <img src="/sa_logo.webp" alt="" width={40} height={40} className="h-9 w-9 shrink-0 object-contain md:h-10 md:w-10" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-bold leading-tight text-[var(--color-on-surface)] md:text-base">
              國立彰化師範大學學生會
            </span>
            <span className="hidden truncate text-xs text-[var(--color-on-surface-variant)] sm:block">學生選舉系統</span>
          </span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(4rem+env(safe-area-inset-top,0px)+1.5rem)] md:px-8 md:pt-[104px]">
        {content}
      </main>
    </div>
  );
}
