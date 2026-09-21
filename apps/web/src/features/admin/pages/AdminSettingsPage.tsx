import React, { useEffect, useState } from "react";
import { Card } from "../../../components/m3/Card";
import { Button } from "../../../components/m3/Button";
import { TextField } from "../../../components/m3/TextField";
import { Settings, Shield, Copy, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../auth/services/auth.api";
import { useToastStore } from "../../../stores/toastStore";

export function AdminSettingsPage() {
  const addToast = useToastStore((state) => state.addToast);
  const [copiedVoter, setCopiedVoter] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);
  
  const [formData, setFormData] = useState<Record<string, string>>({
    VOTER_OIDC_ISSUER: "",
    VOTER_OIDC_CLIENT_ID: "",
    VOTER_OIDC_CLIENT_SECRET: "",
    ADMIN_OIDC_ISSUER: "",
    ADMIN_OIDC_CLIENT_ID: "",
    ADMIN_OIDC_CLIENT_SECRET: "",
    ADMIN_OIDC_USERNAME_CLAIM: "",
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings", "oidc"],
    queryFn: async () => {
      const res = await api.get("/admins/settings/oidc");
      return res.data;
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData((prev) => ({ ...prev, ...settings }));
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (newSettings: Record<string, string>) => {
      const res = await api.put("/admins/settings/oidc", newSettings);
      return res.data;
    },
    onSuccess: () => {
      addToast("OIDC 設定已成功更新", "success");
    },
    onError: () => {
      addToast("更新設定失敗", "error");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const copyToClipboard = (text: string, type: 'voter' | 'admin') => {
    navigator.clipboard.writeText(text);
    if (type === 'voter') {
        setCopiedVoter(true);
        setTimeout(() => setCopiedVoter(false), 2000);
    } else {
        setCopiedAdmin(true);
        setTimeout(() => setCopiedAdmin(false), 2000);
    }
  };

  const voterCallbackUrl = "https://sa-election.ncue.edu.tw/api/auth/callback";
  const adminCallbackUrl = "https://sa-election.ncue.edu.tw/api/auth/admin/callback";

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[var(--color-on-surface-variant)] animate-pulse font-bold">
        載入設定中...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <header className="mb-10 flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tight text-[var(--color-on-surface)] flex items-center gap-3">
          <Settings
            className="w-10 h-10 text-[var(--color-primary)]"
            strokeWidth={2.5}
          />
          系統設定
        </h1>
        <p className="text-[var(--color-on-surface-variant)] font-medium text-lg max-w-2xl opacity-80">
          管理系統的 OIDC
          單一登入與其他核心環境變數配置。若欄位留白，系統將嘗試使用預設的環境變數。
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Voter OIDC Settings */}
        <Card className="p-8 border border-[var(--color-outline-variant)]/30 elevation-1 bg-[var(--color-surface-container-lowest)] rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] flex items-center justify-center elevation-1">
              <Shield className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--color-on-surface)] tracking-tight">
                選舉人 (學生) OIDC 配置
              </h2>
              <p className="text-sm font-medium text-[var(--color-on-surface-variant)] opacity-80 mt-1">
                用於學生登入投票系統的單一登入設定。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 relative z-10">
            <div className="p-5 rounded-2xl bg-[#fff8e1] dark:bg-[#3e2723] border border-[#ffe082] dark:border-[#5d4037]">
                <p className="text-sm font-bold text-[#bb4d00] dark:text-[#ffcc80] flex items-center gap-2">
                    ⚠️ 系統 Callback URL (請於 SSO 配置中使用此網址)：
                </p>
                <div className="mt-3 flex items-center gap-2">
                    <code className="bg-[#ffecb3] dark:bg-[#4e342e] text-[#e65100] dark:text-[#ffe082] px-3 py-2 rounded-xl flex-1 break-all font-mono text-sm border border-[#ffd54f] dark:border-[#6d4c41]">
                        {voterCallbackUrl}
                    </code>
                    <button 
                        type="button" 
                        onClick={() => copyToClipboard(voterCallbackUrl, 'voter')}
                        className="p-2.5 rounded-xl bg-[#ffe082] hover:bg-[#ffd54f] dark:bg-[#5d4037] dark:hover:bg-[#6d4c41] text-[#e65100] dark:text-[#ffcc80] transition-colors"
                        title="複製網址"
                    >
                        {copiedVoter ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextField
                label="Issuer URL"
                value={formData.VOTER_OIDC_ISSUER}
                onChange={(e) =>
                    handleChange("VOTER_OIDC_ISSUER", e.target.value)
                }
                />
                <TextField
                label="Client ID"
                value={formData.VOTER_OIDC_CLIENT_ID}
                onChange={(e) =>
                    handleChange("VOTER_OIDC_CLIENT_ID", e.target.value)
                }
                />
                <TextField
                label="Client Secret"
                type="password"
                value={formData.VOTER_OIDC_CLIENT_SECRET}
                onChange={(e) =>
                    handleChange("VOTER_OIDC_CLIENT_SECRET", e.target.value)
                }
                />
            </div>
          </div>
        </Card>

        {/* Admin OIDC Settings */}
        <Card className="p-8 border border-[var(--color-outline-variant)]/30 elevation-1 bg-[var(--color-surface-container-lowest)] rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-secondary)]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-secondary-container)] text-[var(--color-on-secondary-container)] flex items-center justify-center elevation-1">
              <Shield className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--color-on-surface)] tracking-tight">
                管理員 (Keycloak) OIDC 配置
              </h2>
              <p className="text-sm font-medium text-[var(--color-on-surface-variant)] opacity-80 mt-1">
                用於學生會幹部登入後台的單一登入設定。Issuer 格式為
                <code className="mx-1 font-mono">https://&lt;keycloak&gt;/realms/&lt;realm&gt;</code>。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 relative z-10">
            <div className="p-5 rounded-2xl bg-[#e0f2f1] dark:bg-[#004d40] border border-[#b2dfdb] dark:border-[#00695c]">
                <p className="text-sm font-bold text-[#00695c] dark:text-[#80cbc4] flex items-center gap-2">
                    ⚠️ 系統 Callback URL (請於 SSO 配置中使用此網址)：
                </p>
                <div className="mt-3 flex items-center gap-2">
                    <code className="bg-[#b2dfdb] dark:bg-[#00695c] text-[#004d40] dark:text-[#b2dfdb] px-3 py-2 rounded-xl flex-1 break-all font-mono text-sm border border-[#80cbc4] dark:border-[#00796b]">
                        {adminCallbackUrl}
                    </code>
                    <button 
                        type="button" 
                        onClick={() => copyToClipboard(adminCallbackUrl, 'admin')}
                        className="p-2.5 rounded-xl bg-[#80cbc4] hover:bg-[#4db6ac] dark:bg-[#00796b] dark:hover:bg-[#00897b] text-[#004d40] dark:text-[#e0f2f1] transition-colors"
                        title="複製網址"
                    >
                        {copiedAdmin ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextField
                label="Issuer URL"
                value={formData.ADMIN_OIDC_ISSUER}
                onChange={(e) =>
                    handleChange("ADMIN_OIDC_ISSUER", e.target.value)
                }
                />
                <TextField
                label="Client ID"
                value={formData.ADMIN_OIDC_CLIENT_ID}
                onChange={(e) =>
                    handleChange("ADMIN_OIDC_CLIENT_ID", e.target.value)
                }
                />
                <TextField
                label="Client Secret"
                type="password"
                value={formData.ADMIN_OIDC_CLIENT_SECRET}
                onChange={(e) =>
                    handleChange("ADMIN_OIDC_CLIENT_SECRET", e.target.value)
                }
                />
                <TextField
                label="帳號識別 Claim"
                placeholder="preferred_username"
                value={formData.ADMIN_OIDC_USERNAME_CLAIM}
                onChange={(e) =>
                    handleChange("ADMIN_OIDC_USERNAME_CLAIM", e.target.value)
                }
                />
            </div>

            <p className="text-xs text-[var(--color-on-surface-variant)] opacity-70 leading-relaxed px-1">
                Keycloak 的 <code className="font-mono">sub</code> 是隨機 UUID，無法用來比對權限名單。
                系統預設改讀 <code className="font-mono">preferred_username</code>（即 Keycloak 帳號名稱），
                留白即採用此預設值。
            </p>
          </div>
        </Card>

        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            variant="filled"
            className="px-10 py-6 rounded-2xl text-lg font-bold shadow-lg shadow-[var(--color-primary)]/20"
            loading={updateMutation.isPending}
            disabled={updateMutation.isPending}
          >
            儲存
          </Button>
        </div>
      </form>
    </div>
  );
}
