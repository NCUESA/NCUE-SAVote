import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { candidateApi } from "../../auth/services/candidate.api";
import { voterApi } from "../../auth/services/voter.api";
import { votesApi } from "../services/votes.api";
import { useVoteProof } from "../hooks/useVoteProof";
import { useAuth } from "../../auth/hooks/useAuth";
import { Button } from "../../../components/m3/Button";
import { Dialog } from "../../../components/m3/Dialog";
import {
  Check,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  Loader2,
  X,
  Ban,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "../../../components/ui/PageHeader";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Notice } from "../../../components/ui/Notice";
import { IconTile } from "../../../components/ui/IconTile";
import { encryptWithPublicKey } from "../../../lib/crypto";
import { VOTE_RULES } from "@savote/shared-types";
import {
  generateZkSecret,
  calculateCommitment,
  warmUpPoseidon,
  electionIdToField,
  computeVoteHash,
} from "../../../lib/zk";
import { votersApi } from "../services/voters.api";
import { cn } from "../../../lib/utils";

/** 送票流程的階段，用來給使用者具體的進度說明而不是單一轉圈 */
type SubmitStage = "idle" | "proving" | "encrypting" | "sending";

// 順序是「先加密、再產生證明」：證明裡綁定了選票密文的雜湊，
// 所以必須先有密文才能產生證明。
const STAGE_TEXT: Record<Exclude<SubmitStage, "idle">, { title: string; hint: string }> = {
  encrypting: {
    title: "正在加密您的選票",
    hint: "使用本場選舉的公開金鑰加密，伺服器無法在開票前看到內容。",
  },
  proving: {
    title: "正在產生零知識證明",
    hint: "這一步完全在您的裝置上運算，可能需要 5～30 秒。請不要關閉或離開此頁面。",
  },
  sending: {
    title: "正在送出選票",
    hint: "請稍候，送出後將無法撤回或修改。",
  },
};

export const VotingBooth: React.FC = () => {
  const { electionId } = useParams<{ electionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { generateProof, isLoading: isGeneratingProof, error: proofError } = useVoteProof();

  const [secret, setSecret] = useState<string | null>(null);
  const [isRegisteringKey, setIsRegisteringKey] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [stage, setStage] = useState<SubmitStage>("idle");
  const [localError, setLocalError] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState(false);
  const setupDoneRef = useRef(false);

  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 一進投票頁就開始下載 Poseidon，使用者按下送出時不必再等
  useEffect(() => {
    warmUpPoseidon();
  }, []);

  const normalizeToBigIntString = (value: string) => {
    if (!value) return "";
    try {
      const hex = value.startsWith("0x") ? value : "0x" + value;
      return BigInt(hex).toString();
    } catch {
      return "";
    }
  };

  const { data: candidates, isLoading: isLoadingCandidates } = useQuery({
    queryKey: ["candidates", electionId],
    queryFn: () => candidateApi.findAll(electionId!),
    enabled: !!electionId,
  });

  const {
    data: eligibility,
    isLoading: isLoadingEligibility,
    error: eligibilityError,
  } = useQuery({
    queryKey: ["eligibility", electionId],
    queryFn: () => voterApi.verifyEligibility(electionId!),
    enabled: !!electionId,
    retry: false,
  });
  const election = eligibility?.election;

  // ---------------------------------------------------------------------------
  // 投票金鑰初始化
  // 只在「確定有資格且尚未投票」時才註冊，避免對已投票 / 無資格的使用者
  // 送出註定失敗的 register-commitment 請求。
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const studentId = user?.studentIdHash;
    if (!electionId || !studentId || !eligibility || setupDoneRef.current) return;
    if (!eligibility.eligible || (eligibility as { hasVoted?: boolean }).hasVoted) return;

    setupDoneRef.current = true;

    const initKeyAndRegister = async () => {
      const storageKey = `savote_secret_${electionId}`;
      let existingSecret = localStorage.getItem(storageKey);

      if (!existingSecret) {
        existingSecret = normalizeToBigIntString(generateZkSecret());
        localStorage.setItem(storageKey, existingSecret);
      }
      setSecret(existingSecret);

      if (!eligibility.isRegistered) {
        try {
          setIsRegisteringKey(true);
          setRegisterError(null);
          const commitment = await calculateCommitment(studentId, existingSecret);
          await votersApi.registerCommitment(electionId, commitment);
        } catch (error) {
          // 註冊失敗必須讓使用者知道 —— 原本只有 console.error，
          // 使用者會看到完整投票畫面，按下送出後才神秘失敗。
          const code = (error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message;
          setRegisterError(
            code === "ALREADY_REGISTERED"
              ? "此裝置的投票金鑰與伺服器紀錄不符。請改用您首次開啟投票頁的那個瀏覽器／裝置。"
              : "投票資格初始化失敗，請重新整理頁面再試一次。",
          );
        } finally {
          setIsRegisteringKey(false);
        }
      }
    };

    void initKeyAndRegister();
  }, [electionId, user?.studentIdHash, eligibility]);

  const submitVoteMutation = useMutation({
    mutationFn: votesApi.submitVote,
    onSuccess: (data) => {
      // 帶上選舉資訊，成功頁才能顯示場次名稱並提供「回查投票狀態」的入口
      navigate("/vote/success", {
        state: { receipt: data, electionId, electionName: election?.name },
        replace: true, // 投完票不該能用上一頁回到投票畫面
      });
    },
  });

  const isBusy = stage !== "idle" || isGeneratingProof || submitVoteMutation.isPending;

  const handleVote = async () => {
    setIsConfirmDialogOpen(false);
    setLocalError(null);
    setDismissedError(false);

    if (!electionId || !election?.publicKey || !secret || !user?.studentIdHash) {
      setLocalError("缺少投票所需的參數，請重新整理頁面後再試。");
      return;
    }

    const finalVoteValue = selectedCandidate || VOTE_RULES.BLANK_VOTE;

    try {
      // 1. 先加密：證明要綁定選票密文的雜湊，所以必須先有密文
      setStage("encrypting");
      const encryptedVoteContent = await encryptWithPublicKey(finalVoteValue, election.publicKey);
      const voteHash = await computeVoteHash(encryptedVoteContent);

      // 2. 產生證明：同時綁定這一場選舉與這一張選票
      setStage("proving");
      const { proof, publicSignals } = await generateProof({
        studentId: normalizeToBigIntString(user.studentIdHash),
        secret: normalizeToBigIntString(secret),
        electionId: electionIdToField(electionId),
        voteHash,
      });

      // 本機自我檢查：證明的公開輸出必須等於本機算出的 commitment。
      // 不相符代表金鑰與伺服器登記的不是同一把，送出必定失敗，
      // 在這裡擋下來才能給出可行動的錯誤訊息。
      const expectedCommitment = await calculateCommitment(user.studentIdHash, secret);
      if (expectedCommitment !== publicSignals[0]) {
        setStage("idle");
        setLocalError(
          "投票金鑰驗證失敗：此裝置的金鑰與登記紀錄不符。請改用您首次開啟投票頁的瀏覽器／裝置。",
        );
        return;
      }

      setStage("sending");
      await submitVoteMutation.mutateAsync({
        electionId,
        voteContent: encryptedVoteContent,
        encryptKey: "RSA-OAEP",
        proof,
        publicSignals,
      });
    } catch (err) {
      setLocalError(
        (err as Error)?.message || "送出選票時發生錯誤，請確認網路連線後再試一次。",
      );
    } finally {
      setStage("idle");
    }
  };

  const selectedCandidateData = candidates?.find((c) => c.id === selectedCandidate);

  // ---------------------------------------------------------------------------
  // 鍵盤操作：候選人清單是一組 radio，依 WAI-ARIA radiogroup 模式處理
  // 上/下/左/右移動、Space/Enter 選取、Home/End 跳首尾。
  // 原本是 <div onClick>，鍵盤與螢幕閱讀器使用者完全無法投票。
  // ---------------------------------------------------------------------------
  const handleOptionKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const list = candidates ?? [];
      if (list.length === 0) return;

      const move = (next: number) => {
        e.preventDefault();
        const target = (next + list.length) % list.length;
        optionRefs.current[target]?.focus();
        setSelectedCandidate(list[target].id);
      };

      switch (e.key) {
        case "ArrowDown":
        case "ArrowRight":
          move(index + 1);
          break;
        case "ArrowUp":
        case "ArrowLeft":
          move(index - 1);
          break;
        case "Home":
          move(0);
          break;
        case "End":
          move(list.length - 1);
          break;
        case " ":
        case "Enter":
          e.preventDefault();
          setSelectedCandidate((prev) => (prev === list[index].id ? null : list[index].id));
          break;
      }
    },
    [candidates],
  );

  if (isLoadingCandidates || isLoadingEligibility || isRegisteringKey) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" aria-hidden="true" />
        <p className="text-[15px] text-[var(--color-on-surface-variant)]">
          {isRegisteringKey ? "正在初始化投票資格…" : "載入中…"}
        </p>
      </div>
    );
  }

  if (eligibilityError || (eligibility && (!eligibility.eligible || (eligibility as { hasVoted?: boolean }).hasVoted))) {
    const isAlreadyVoted = (eligibility as { hasVoted?: boolean })?.hasVoted;
    const message = isAlreadyVoted
      ? "您已經成功投過票，無法重複提交選票。"
      : eligibility?.reason === "NOT_ELIGIBLE"
        ? "您不在本場選舉的選舉人名單中。若認為有誤，請聯繫學生會選舉委員會。"
        : eligibility?.reason || "您不符合此次選舉的投票資格。";

    return (
      <div className="mx-auto max-w-xl py-6">
        <EmptyState
          icon={isAlreadyVoted ? CheckCircle2 : Ban}
          tone={isAlreadyVoted ? "neutral" : "warning"}
          title={isAlreadyVoted ? "已完成投票" : "無法投票"}
          description={message}
          action={
            <Button variant="tonal" onClick={() => navigate("/")} icon={<ChevronLeft className="h-4 w-4" />}>
              返回選舉列表
            </Button>
          }
        />
      </div>
    );
  }

  const activeError =
    !dismissedError && (localError || registerError || proofError || (submitVoteMutation.error as Error | null)?.message);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-40 md:pb-32">
      <PageHeader
        title={election?.name ?? "投票"}
        description="請選擇一位候選人，或不圈選任何人以投下廢票。選票送出後無法修改。"
        back="/"
        backLabel="選舉列表"
      />

      {registerError && <Notice tone="error">{registerError}</Notice>}

      {/* radiogroup：讓輔助技術把這塊讀成「一組單選選項，共 N 項」 */}
      <div
        role="radiogroup"
        aria-label="候選人"
        aria-describedby="vote-hint"
        className="stagger grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        {candidates?.map((candidate, index) => {
          const isSelected = selectedCandidate === candidate.id;
          return (
            <div
              key={candidate.id}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              role="radio"
              aria-checked={isSelected}
              // 未選取時只有第一項可被 Tab 聚焦，之後用方向鍵在組內移動（ARIA 慣例）
              tabIndex={isSelected || (!selectedCandidate && index === 0) ? 0 : -1}
              onKeyDown={(e) => handleOptionKeyDown(e, index)}
              onClick={() => setSelectedCandidate((prev) => (prev === candidate.id ? null : candidate.id))}
              className={cn(
                "focus-ring flex cursor-pointer items-start gap-4 rounded-3xl bg-[var(--color-surface-container-lowest)] p-4 md:p-5",
                "transition-[box-shadow,background-color,transform] duration-[var(--dur-control)] ease-[var(--ease-standard)] active:scale-[0.99]",
                isSelected
                  ? "shadow-[inset_0_0_0_2px_var(--color-primary)]"
                  : "hover:bg-[var(--color-surface-container-lowest)] hover:shadow-[inset_0_0_0_1px_var(--color-outline-variant)]",
              )}
            >
              {candidate.photoUrl ? (
                <img
                  src={candidate.photoUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-16 w-16 shrink-0 rounded-2xl object-cover md:h-20 md:w-20"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-surface-container)] text-2xl font-semibold text-[var(--color-on-surface-variant)] md:h-20 md:w-20"
                >
                  {candidate.name.charAt(0)}
                </span>
              )}

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="type-title-large text-[var(--color-on-surface)]">
                    <span className="mr-2 tabular text-[var(--color-on-surface-variant)]">{index + 1}</span>
                    {candidate.name}
                  </h2>
                  {/* 已選取不只用顏色表示，另外有明確的勾選標記（WCAG 1.4.1） */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--dur-micro)]",
                      isSelected
                        ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                        : "shadow-[inset_0_0_0_2px_var(--color-outline)]",
                    )}
                  >
                    {isSelected && <Check className="h-4 w-4 animate-scale-in" strokeWidth={3} />}
                  </span>
                </div>
                {candidate.bio && (
                  <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-[var(--color-on-surface-variant)]">
                    {candidate.bio}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 送出列：和導航列同一種浮動玻璃膠囊，手機版疊在導航列上方 */}
      <div
        className={cn(
          "glass fixed inset-x-3 z-30 flex items-center gap-3 rounded-3xl p-2 pl-5",
          "bottom-[calc(var(--spacing-nav-bottom)+env(safe-area-inset-bottom,0px)+0.25rem)]",
          "md:inset-x-auto md:bottom-6 md:left-[calc(50%+56px)] md:w-[min(36rem,calc(100%-160px))] md:-translate-x-1/2",
        )}
      >
        <p id="vote-hint" className="min-w-0 flex-1 text-sm leading-snug text-[var(--color-on-surface-variant)]">
          <span className="block text-xs">已選擇</span>
          <span className="block truncate font-semibold text-[var(--color-on-surface)]">
            {selectedCandidateData?.name ?? "未圈選（將計為廢票）"}
          </span>
        </p>
        <Button
          size="lg"
          disabled={isBusy || Boolean(registerError)}
          loading={isBusy}
          onClick={() => setIsConfirmDialogOpen(true)}
          className="px-6"
        >
          {stage === "encrypting"
            ? "加密中…"
            : stage === "proving"
              ? "產生證明…"
              : stage === "sending"
                ? "送出中…"
                : "確認投票"}
        </Button>
      </div>

      <Dialog
        open={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        title={selectedCandidate ? "確認您的選票" : "確認投下廢票"}
        description={
          selectedCandidate
            ? "送出後將無法撤回或修改，請確認您的選擇。"
            : "您目前尚未圈選任何候選人。若繼續送出，將被計為「廢票」。"
        }
        actions={
          <>
            <Button variant="text" color="secondary" onClick={() => setIsConfirmDialogOpen(false)}>
              返回修改
            </Button>
            <Button
              onClick={handleVote}
              loading={isBusy}
              color={selectedCandidate ? "primary" : "error"}
            >
              {selectedCandidate ? "送出選票" : "確認投下廢票"}
            </Button>
          </>
        }
      >
        {selectedCandidateData ? (
          <div className="flex items-center gap-4 rounded-2xl bg-[var(--color-surface-container)] p-4">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-xl font-semibold text-[var(--color-on-primary)]"
            >
              {selectedCandidateData.name.charAt(0)}
            </span>
            <div className="min-w-0">
              <div className="text-xs text-[var(--color-on-surface-variant)]">您選擇的是</div>
              <div className="type-title-large truncate text-[var(--color-on-surface)]">
                {selectedCandidateData.name}
              </div>
            </div>
          </div>
        ) : (
          <Notice tone="warning" icon={Ban} title="均不圈選">
            這張選票將計為廢票。
          </Notice>
        )}

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[var(--color-on-surface-variant)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
          您的選票會在送出前於本機加密，並以零知識證明驗證投票資格。
        </p>
      </Dialog>

      {/* 處理中的全螢幕遮罩：ZK 證明在手機上可能跑 30 秒，
          必須明確告知使用者「不要關閉頁面」，否則會以為卡住而重新整理。 */}
      {isBusy && (
        <div
          role="status"
          aria-live="assertive"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-6 animate-fade-in"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[var(--color-surface-container-lowest)] p-7 text-center elevation-5 animate-scale-in">
            <Loader2
              className="mx-auto mb-4 h-9 w-9 animate-spin text-[var(--color-primary)]"
              aria-hidden="true"
            />
            <h2 className="type-title-large text-[var(--color-on-surface)]">
              {STAGE_TEXT[stage === "idle" ? "encrypting" : stage].title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-on-surface-variant)]">
              {STAGE_TEXT[stage === "idle" ? "encrypting" : stage].hint}
            </p>
          </div>
        </div>
      )}

      {activeError && (
        <div
          role="alert"
          className="fixed inset-x-3 z-[65] flex items-start gap-3 rounded-3xl bg-[var(--color-surface-container-lowest)] p-4 elevation-4 animate-slide-up bottom-[calc(var(--spacing-nav-bottom)+env(safe-area-inset-bottom,0px)+5.25rem)] md:inset-x-auto md:bottom-28 md:left-[calc(50%+56px)] md:w-[28rem] md:-translate-x-1/2"
        >
          <IconTile icon={AlertTriangle} tone="error" size="sm" />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="type-title-small text-[var(--color-on-surface)]">無法送出選票</div>
            <div className="mt-0.5 text-sm leading-relaxed text-[var(--color-on-surface-variant)]">{activeError}</div>
          </div>
          <button
            type="button"
            aria-label="關閉錯誤訊息"
            onClick={() => {
              setDismissedError(true);
              setLocalError(null);
              submitVoteMutation.reset();
            }}
            className="focus-ring -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-on-surface-variant)] hover:bg-[var(--color-on-surface)]/[0.06]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
