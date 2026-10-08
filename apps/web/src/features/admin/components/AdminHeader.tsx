import { PageHeader } from '../../../components/ui/PageHeader';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  actions?: React.ReactNode;
}

/** 後台頁首。保留原本的介面給既有呼叫端，實際外觀統一由 PageHeader 決定。 */
export function AdminHeader({ title, subtitle, showBack = true, actions }: AdminHeaderProps) {
  return (
    <PageHeader
      title={title}
      description={subtitle}
      actions={actions}
      back={showBack ? '/admin' : undefined}
      backLabel="後台總覽"
    />
  );
}
