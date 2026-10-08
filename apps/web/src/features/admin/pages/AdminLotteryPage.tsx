import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../auth/services/auth.api";
import { API_ENDPOINTS } from "../../../lib/constants";
import { Button } from '../../../components/m3/Button';
import { TextField } from '../../../components/m3/TextField';
import { AdminHeader } from '../components/AdminHeader';
import { type Election } from "@savote/shared-types";
import { Dices } from "lucide-react";
import { formatNumber } from '../../../lib/datetime';
import { Section } from '../../../components/ui/Section';
import { Select } from '../../../components/ui/Select';
import { Notice } from '../../../components/ui/Notice';

interface LotteryResult {
    totalParticipants: number;
    drawCount: number;
    winners: string[];
}

export function AdminLotteryPage() {
    const [selectedElectionId, setSelectedElectionId] = useState<string>("");
    const [drawCount, setDrawCount] = useState<number>(1);
    const [isDrawing, setIsDrawing] = useState(false);
    const [result, setResult] = useState<LotteryResult | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // 撈取選舉清單
    const { data: elections = [], isLoading } = useQuery({
        queryKey: ["elections-lottery"],
        queryFn: async () => {
            const res = await api.get<Election[]>(API_ENDPOINTS.ELECTIONS.LIST);
            return res.data;
        },
    });

    const now = new Date();
    const monitorableElections = elections.filter(
        (e) => e.endTime && now > new Date(e.endTime)
    );

    const handleDraw = async () => {
        if (!selectedElectionId || drawCount <= 0) return;
        setIsDrawing(true);
        setResult(null);
        setErrorMsg(null);

        try {
            await api.get<LotteryResult>(`/elections/${selectedElectionId}/lottery/draw?count=${drawCount}`);

            const res = await api.get<LotteryResult>(`/elections/${selectedElectionId}/lottery`);
            // 故意延遲 1.5 秒，營造抽獎的緊張感 (選用)
            setTimeout(() => {
                setResult(res.data);
                setIsDrawing(false);
            }, 1500);

        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.message || "發生預期外的錯誤";

            setErrorMsg(`抽獎失敗：${msg}`);
            setIsDrawing(false);
        }
    };

    return (
        <div className="space-y-6 pb-8">
            <AdminHeader
                title="抽獎"
                subtitle="從已完成投票的選民中隨機抽出得獎者。只有已結束的選舉可以抽獎。"
            />

            {!isLoading && monitorableElections.length === 0 ? (
                <Notice tone="neutral" title="目前沒有可以抽獎的選舉">
                    選舉的投票時間結束後，才會出現在這裡。
                </Notice>
            ) : (
                <Section>
                    <div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_9rem]">
                            <Select
                                label="選舉"
                                value={selectedElectionId}
                                onChange={(e) => {
                                    setSelectedElectionId(e.target.value);
                                    setResult(null); // 切換選舉時清空結果
                                    setErrorMsg(null);
                                }}
                            >
                                <option value="">請選擇已結束的選舉</option>
                                {monitorableElections.map((election) => (
                                    <option key={election.id} value={election.id}>
                                        {election.name}
                                    </option>
                                ))}
                            </Select>

                            <TextField
                                label="抽出人數"
                                type="number"
                                min={1}
                                inputMode="numeric"
                                className="tabular"
                                value={drawCount}
                                onChange={(e) => setDrawCount(parseInt(e.target.value) || 1)}
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button
                                size="lg"
                                onClick={handleDraw}
                                disabled={!selectedElectionId || isDrawing || drawCount < 1}
                                loading={isDrawing}
                                className="w-full md:w-auto"
                                icon={<Dices className="h-5 w-5" />}
                            >
                                {isDrawing ? "抽籤中…" : "抽出得獎者"}
                            </Button>
                        </div>
                    </div>
                </Section>
            )}

            {errorMsg && <Notice tone="error">{errorMsg}</Notice>}

            {/* 抽獎結果 */}
            {result && (
                <Section
                    title="抽獎結果"
                    description={`已從 ${formatNumber(result.totalParticipants)} 位已投票選民中，抽出 ${formatNumber(result.drawCount)} 位得獎者。`}
                    className="animate-slide-up"
                >
                    <ol className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                        {result.winners.map((studentId, index) => (
                            <li
                                key={index}
                                className="flex items-center gap-3 rounded-2xl bg-[var(--color-surface-container)] p-4"
                            >
                                <span
                                    aria-hidden="true"
                                    className="tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-container)] text-sm font-semibold text-[var(--color-on-primary-container)]"
                                >
                                    {index + 1}
                                </span>
                                <span className="sr-only">第 {index + 1} 位：</span>
                                <span className="type-title-medium tabular min-w-0 truncate text-[var(--color-on-surface)]">
                                    {studentId}
                                </span>
                            </li>
                        ))}
                    </ol>
                </Section>
            )}
        </div>
    );
}
