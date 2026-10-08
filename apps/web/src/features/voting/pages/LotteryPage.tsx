import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../auth/services/auth.api";
import { API_ENDPOINTS } from "../../../lib/constants";
import { PageHeader } from '../../../components/ui/PageHeader';
import { Section } from '../../../components/ui/Section';
import { Select } from '../../../components/ui/Select';
import { Notice } from '../../../components/ui/Notice';
import { EmptyState } from '../../../components/ui/EmptyState';
import { type Election } from "@savote/shared-types";
import { Gift } from "lucide-react";

interface LotteryResult {
    totalParticipants: number;
    drawCount: number;
    winners: string[];
}

export function LotteryPage() {
    const [selectedElectionId, setSelectedElectionId] = useState<string>("");
    const [result, setResult] = useState<LotteryResult | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // 撈取選舉清單
    const { data: elections = [] } = useQuery({
        queryKey: ["elections-lottery"],
        queryFn: async () => {
            const res = await api.get<Election[]>(API_ENDPOINTS.ELECTIONS.LIST);
            return res.data;
        },
    });

    // 原本在 onChange 裡呼叫 handleDraw()，讀到的是「切換前」的 selectedElectionId，
    // 所以每次顯示的都是上一個選項的結果。改為直接傳入新的 id。
    async function loadResult(electionId: string) {
        setResult(null);
        setErrorMsg(null);
        if (!electionId) return;
        setIsLoading(true);
        try {
            const res = await api.get<LotteryResult>(`/elections/${electionId}/lottery`);
            setResult(res.data);
        } catch (error: any) {
            const msg = error.response?.data?.message || "發生預期外的錯誤";
            setErrorMsg(Array.isArray(msg) ? msg.join("、") : msg);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6 pb-8">
            <PageHeader title="抽獎結果" description="選舉結束後，參與投票的選舉人會參加抽獎。選擇選舉以查看得獎名單。" />

            <Section bodyClassName="p-5">
                <Select
                    label="選舉"
                    value={selectedElectionId}
                    onChange={(e) => {
                        setSelectedElectionId(e.target.value);
                        void loadResult(e.target.value);
                    }}
                >
                    <option value="">請選擇選舉</option>
                    {elections.map((election) => (
                        <option key={election.id} value={election.id}>
                            {election.name}
                        </option>
                    ))}
                </Select>
            </Section>

            {errorMsg && <Notice tone="error" title="無法取得抽獎結果">{errorMsg}</Notice>}

            {isLoading && <div role="status" aria-label="載入中" className="skeleton h-48 rounded-3xl" />}

            {result && (
                <Section
                    title="得獎名單"
                    description={`共 ${result.totalParticipants.toLocaleString("en-US")} 位參與者，抽出 ${result.drawCount} 位。`}
                    card={false}
                >
                    {result.winners.length === 0 ? (
                        <EmptyState icon={Gift} title="尚未抽出得獎者" description="開獎後，得獎名單會顯示在這裡。" />
                    ) : (
                        <ol className="stagger grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
                            {result.winners.map((studentId, index) => (
                                <li
                                    key={`${studentId}-${index}`}
                                    className="flex items-center gap-4 rounded-3xl bg-[var(--color-surface-container-lowest)] px-5 py-4"
                                >
                                    <span className="tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-container)] text-[15px] font-semibold text-[var(--color-on-primary-container)]">
                                        {index + 1}
                                    </span>
                                    <span className="tabular font-mono text-lg font-semibold tracking-wide text-[var(--color-on-surface)]">
                                        {studentId}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                </Section>
            )}
        </div>
    );
}
