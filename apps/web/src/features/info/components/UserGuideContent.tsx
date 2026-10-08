import { UserCircle2, Lock, Fingerprint, Send, Smartphone } from 'lucide-react';
import { IconTile } from '../../../components/ui/IconTile';
import { Notice } from '../../../components/ui/Notice';

interface GuideStep {
  title: string;
  desc: string;
  icon: React.ElementType;
}

/**
 * 給選民看的流程說明。
 *
 * 文案刻意只描述系統實際做到的事：
 * 原本寫的是「分散式存證」「不可竄改性與公開可稽核性」「絕對匿名與抗關聯性」，
 * 但本系統並沒有分散式帳本（選票就是資料庫的一列），也沒有公開可稽核的機制。
 * 在選舉系統裡對選民誇大安全保證，比介面醜還嚴重。
 */
const STEPS: GuideStep[] = [
  {
    title: '以校園單一簽入確認投票資格',
    desc: '系統透過彰師單一簽入（SSO）確認您是否在本場選舉的選舉人名單中。您的校園密碼全程由學校的登入系統處理，本系統不會經手也不會儲存。',
    icon: UserCircle2,
  },
  {
    title: '在您的裝置上產生投票金鑰',
    desc: '投票金鑰只在您的瀏覽器裡產生並保存，不會傳送到伺服器。送出選票時，系統以零知識證明向伺服器證明「您持有一把合法的投票金鑰」，而不需要出示金鑰本身。',
    icon: Fingerprint,
  },
  {
    title: '選票在送出前先於裝置上加密',
    desc: '您圈選的內容會先用本場選舉的公開金鑰加密，再送出。伺服器在開票前無法讀取選票內容；投票資格同時被核銷，同一場選舉無法重複投票。',
    icon: Send,
  },
];

export function UserGuideContent() {
  return (
    <div className="space-y-4">
      <ol className="list-none divide-y divide-[var(--color-outline-variant)] overflow-hidden rounded-3xl bg-[var(--color-surface-container-lowest)] p-0">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex items-start gap-4 p-5">
            <IconTile icon={step.icon} tone="primary" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--color-primary)]">步驟 {index + 1}</p>
              <h3 className="type-title-medium mt-0.5 text-[var(--color-on-surface)]">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-on-surface-variant)]">{step.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* 這是真正會影響選民的事，必須講清楚 */}
      <Notice tone="warning" icon={Smartphone} title="請用同一台裝置、同一個瀏覽器完成投票">
        投票金鑰只存在您第一次開啟投票頁的那個瀏覽器裡。若中途換裝置、換瀏覽器，或清除了瀏覽資料，將無法完成投票。
      </Notice>

      <Notice tone="neutral" icon={Lock}>
        選票內容在離開您的裝置前就已加密，伺服器於開票前無法讀取。
      </Notice>
    </div>
  );
}
