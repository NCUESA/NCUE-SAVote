import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import {
  Vote,
  Users,
  Activity,
  ShieldCheck,
  Coins,
  SlidersHorizontal,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { UserRole } from '@savote/shared-types';
import { PageHeader } from '../../../components/ui/PageHeader';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Section } from '../../../components/ui/Section';
import { IconTile } from '../../../components/ui/IconTile';

interface AdminFeature {
  title: string;
  description: string;
  icon: React.ElementType;
  to: string;
}

interface FeatureGroup {
  title: string;
  description?: string;
  /** 整組僅超級管理員可用 */
  superAdminOnly?: boolean;
  items: AdminFeature[];
}

// iOS「設定」式的分組清單：選務一組、系統一組。
// 原本是六張等高的大卡片，手機上要捲很久才找得到要的功能。
const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: '選務',
    description: '選舉、名冊、開票與抽獎',
    items: [
      {
        title: '選舉管理',
        description: '建立選舉、設定投票起訖時間與候選人名單',
        icon: Vote,
        to: '/admin/elections',
      },
      {
        title: '選舉人管理',
        description: '匯入選舉人名冊、查看登記狀態',
        icon: Users,
        to: '/admin/voters',
      },
      {
        title: '開票監控',
        description: '查看投票統計與當選結果',
        icon: Activity,
        to: '/admin/monitoring',
      },
      {
        title: '抽獎',
        description: '選舉結束後從投票者中抽出得獎者',
        icon: Coins,
        to: '/admin/lottery',
      },
    ],
  },
  {
    title: '系統',
    description: '僅限超級管理員',
    superAdminOnly: true,
    items: [
      {
        title: '權限管理',
        description: '管理可以進入後台的帳號與權限級別',
        icon: ShieldCheck,
        to: '/admin/accounts',
      },
      {
        title: '系統設定',
        description: '學生與管理員的 OIDC 單一簽入設定',
        icon: SlidersHorizontal,
        to: '/admin/settings',
      },
    ],
  },
];

// 清單列在白卡裡，焦點框要畫在列的內側，否則會被卡片的圓角裁掉
const ROW =
  'flex items-center gap-4 px-4 py-3.5 md:px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]';

export function AdminDashboardPage() {
  const { user } = useAuth();

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  if (user && !isAdmin) return <Navigate to="/" replace />;
  if (!user) return null;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="管理後台"
        description={`${user.name ? `${user.name}，` : ''}歡迎使用學生選舉系統選務後台。`}
        meta={
          isSuperAdmin && (
            <StatusBadge tone="tertiary" icon={ShieldCheck}>
              超級管理員
            </StatusBadge>
          )
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {FEATURE_GROUPS.map((group) => {
          const locked = Boolean(group.superAdminOnly) && !isSuperAdmin;
          return (
            <Section key={group.title} title={group.title} description={group.description} card={false}>
              <ul className="stagger list-none divide-y divide-[var(--color-outline-variant)] overflow-hidden rounded-3xl bg-[var(--color-surface-container-lowest)] p-0">
                {group.items.map((feature) => (
                  <li key={feature.to}>
                    {locked ? (
                      // 權限不足時不是連結，而且明確說明原因，不只是變灰
                      <div aria-disabled="true" className={ROW}>
                        <IconTile icon={feature.icon} tone="neutral" />
                        <div className="min-w-0 flex-1">
                          <p className="type-title-small text-[var(--color-on-surface-variant)]">{feature.title}</p>
                          <p className="mt-0.5 text-[13px] leading-snug text-[var(--color-on-surface-variant)]">
                            需要超級管理員權限
                          </p>
                        </div>
                        <Lock className="h-[18px] w-[18px] shrink-0 text-[var(--color-on-surface-variant)]" aria-hidden="true" />
                      </div>
                    ) : (
                      <Link
                        to={feature.to}
                        className={`${ROW} group transition-colors duration-[var(--dur-micro)] hover:bg-[var(--color-on-surface)]/[0.03] active:bg-[var(--color-on-surface)]/[0.06]`}
                      >
                        <IconTile icon={feature.icon} tone="primary" />
                        <div className="min-w-0 flex-1">
                          <p className="type-title-small text-[var(--color-on-surface)]">{feature.title}</p>
                          <p className="mt-0.5 text-[13px] leading-snug text-[var(--color-on-surface-variant)]">
                            {feature.description}
                          </p>
                        </div>
                        <ChevronRight
                          className="h-5 w-5 shrink-0 text-[var(--color-outline)] transition-transform duration-[var(--dur-micro)] group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          );
        })}
      </div>
    </div>
  );
}
