import React, { useEffect, useState } from "react";
import { Button } from "../../../components/m3/Button";
import { TextField } from "../../../components/m3/TextField";
import { Copy, Check } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../auth/services/auth.api";
import { useToastStore } from "../../../stores/toastStore";
import { AdminHeader } from "../components/AdminHeader";
import { Section } from "../../../components/ui/Section";
import { IconButton } from "../../../components/ui/IconButton";

/**
 * Callback URL 區塊：卡片裡的灰色內層區塊，與其他頁的「卡片內區塊」同一種寫法。
 * 原本選舉人與管理員兩塊用了兩套硬寫的十六進位色，後來又是帶外框的藍底提示框。
 */
function CallbackUrlBox({
  url,
  copied,
  onCopy,
  scope,
}: {
  url: string;
  copied: boolean;
  onCopy: () => void;
  scope: string;
}) {
  return (
    <div className="rounded-2xl bg-[var(--color-surface-container)] p-4">
      <p className="text-sm font-semibold text-[var(--color-on-surface)]">Callback URL</p>
      <p className="mt-0.5 text-[13px] leading-snug text-[var(--color-on-surface-variant)]">
        請在{scope} 的設定中填入這個網址。
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-sm leading-relaxed text-[var(--color-on-surface)]">
          {url}
        </code>
        <IconButton
          tone="primary"
          onClick={onCopy}
          aria-label={copied ? `已複製${scope} 的 Callback URL` : `複製${scope} 的 Callback URL`}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </IconButton>
      </div>
    </div>
  );
}

const SECRET_HINT = "機敏資訊。儲存後只會顯示遮罩，保持原樣即不會變更。";

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

  const header = (
    <AdminHeader
      title="系統設定"
      subtitle="學生與管理員的 OIDC 單一簽入設定。欄位留白時，系統會改用伺服器的環境變數。"
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        {header}
        <div role="status" aria-label="載入設定中" className="space-y-6">
          <div className="skeleton h-80 rounded-3xl" />
          <div className="skeleton h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {header}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="選舉人（學生）登入" description="學生登入投票系統所用的單一簽入設定。">
          <div className="space-y-5">
            <CallbackUrlBox
              url={voterCallbackUrl}
              copied={copiedVoter}
              onCopy={() => copyToClipboard(voterCallbackUrl, 'voter')}
              scope="學生 SSO"
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <TextField
                className="md:col-span-2"
                label="Issuer URL"
                value={formData.VOTER_OIDC_ISSUER}
                onChange={(e) => handleChange("VOTER_OIDC_ISSUER", e.target.value)}
              />
              <TextField
                label="Client ID"
                value={formData.VOTER_OIDC_CLIENT_ID}
                onChange={(e) => handleChange("VOTER_OIDC_CLIENT_ID", e.target.value)}
              />
              <TextField
                label="Client Secret"
                type="password"
                autoComplete="off"
                value={formData.VOTER_OIDC_CLIENT_SECRET}
                onChange={(e) => handleChange("VOTER_OIDC_CLIENT_SECRET", e.target.value)}
                helperText={SECRET_HINT}
              />
            </div>
          </div>
        </Section>

        <Section title="管理員（Keycloak）登入" description="學生會幹部登入後台所用的單一簽入設定。">
          <div className="space-y-5">
            <CallbackUrlBox
              url={adminCallbackUrl}
              copied={copiedAdmin}
              onCopy={() => copyToClipboard(adminCallbackUrl, 'admin')}
              scope="管理員 Keycloak"
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <TextField
                className="md:col-span-2"
                label="Issuer URL"
                placeholder="https://<keycloak>/realms/<realm>"
                value={formData.ADMIN_OIDC_ISSUER}
                onChange={(e) => handleChange("ADMIN_OIDC_ISSUER", e.target.value)}
                helperText="格式為 https://<keycloak>/realms/<realm>"
              />
              <TextField
                label="Client ID"
                value={formData.ADMIN_OIDC_CLIENT_ID}
                onChange={(e) => handleChange("ADMIN_OIDC_CLIENT_ID", e.target.value)}
              />
              <TextField
                label="Client Secret"
                type="password"
                autoComplete="off"
                value={formData.ADMIN_OIDC_CLIENT_SECRET}
                onChange={(e) => handleChange("ADMIN_OIDC_CLIENT_SECRET", e.target.value)}
                helperText={SECRET_HINT}
              />
              <TextField
                className="md:col-span-2"
                label="帳號識別 Claim"
                placeholder="preferred_username"
                value={formData.ADMIN_OIDC_USERNAME_CLAIM}
                onChange={(e) => handleChange("ADMIN_OIDC_USERNAME_CLAIM", e.target.value)}
                helperText="Keycloak 的 sub 是隨機 UUID，無法用來比對權限名單。留白即採用 preferred_username（Keycloak 帳號名稱）。"
              />
            </div>
          </div>
        </Section>

        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            className="w-full md:w-auto"
            loading={updateMutation.isPending}
            disabled={updateMutation.isPending}
          >
            儲存設定
          </Button>
        </div>
      </form>
    </div>
  );
}
