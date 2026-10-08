import { UserGuideContent } from '../components/UserGuideContent';
import { PageHeader } from '../../../components/ui/PageHeader';

export function UserGuidePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <PageHeader
        title="操作指南"
        description="投票流程共三個步驟，以下說明每一步實際發生了什麼事。"
        back="/"
        backLabel="選舉列表"
      />

      <UserGuideContent />
    </div>
  );
}
