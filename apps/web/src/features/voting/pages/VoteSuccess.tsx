import React from "react";
import { useLocation } from "react-router-dom";
import { ButtonLink } from "../../../components/m3/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { IconTile } from "../../../components/ui/IconTile";
import {
  Check,
  AlertTriangle,
  Home,
  ChevronLeft,
  ShieldCheck,
  Lock,
  ClipboardCheck,
} from "lucide-react";

interface SuccessState {
  receipt?: unknown;
  electionId?: string;
  electionName?: string;
}

export const VoteSuccess: React.FC = () => {
  const location = useLocation();
  const state = (location.state ?? {}) as SuccessState;
  const { receipt, electionId, electionName } = state;

  if (!receipt) {
    return (
      <div className="mx-auto max-w-xl py-6">
        <EmptyState
          icon={AlertTriangle}
          tone="warning"
          title="找不到投票紀錄"
          description="這個頁面需要從投票流程進入。若您剛完成投票，可回到該場選舉確認狀態。"
          action={
            <ButtonLink to="/" variant="tonal" icon={<ChevronLeft className="h-4 w-4" />}>
              返回選舉列表
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const facts = [
    { icon: Lock, title: "選票內容已加密", body: "伺服器在開票前無法讀取您投給誰。" },
    { icon: ShieldCheck, title: "投票資格已核銷", body: "同一場選舉無法重複投票。" },
    ...(electionId
      ? [{ icon: ClipboardCheck, title: "想再次確認？", body: "回到該場投票頁，狀態應顯示為「已完成投票」。" }]
      : []),
  ];

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center py-6">
      {/* 全站唯一允許慶祝感的地方：勾選用 spring 曲線彈入，其餘資訊逐項淡入 */}
      <div role="status" className="flex flex-col items-center text-center">
        <span
          aria-hidden="true"
          className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-success)] text-[var(--color-on-success)] motion-safe:animate-[scale-in_var(--dur-ceremony)_var(--ease-spring)]"
        >
          <Check className="h-10 w-10" strokeWidth={3} />
        </span>
        <h1 className="type-display-small mt-6 text-[var(--color-on-surface)]">您的選票已送出</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-on-surface-variant)]">
          {electionName ? `「${electionName}」` : "本場選舉"}的投票已完成。開票將於投票截止後進行。
        </p>
      </div>

      <ul className="stagger mt-8 list-none divide-y divide-[var(--color-outline-variant)] overflow-hidden rounded-3xl bg-[var(--color-surface-container-lowest)] p-0">
        {facts.map(({ icon, title, body }) => (
          <li key={title} className="flex items-start gap-3.5 px-5 py-4">
            <IconTile icon={icon} tone="primary" size="sm" />
            <div className="min-w-0 pt-0.5">
              <p className="type-title-small text-[var(--color-on-surface)]">{title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-[var(--color-on-surface-variant)]">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
        <ButtonLink to="/" size="lg" className="w-full sm:flex-1" icon={<Home className="h-5 w-5" />}>
          返回選舉列表
        </ButtonLink>
        {electionId && (
          <ButtonLink
            to={`/vote/${electionId}`}
            variant="outlined"
            size="lg"
            className="w-full sm:flex-1"
            icon={<ClipboardCheck className="h-5 w-5" />}
          >
            確認投票狀態
          </ButtonLink>
        )}
      </div>
    </div>
  );
};
