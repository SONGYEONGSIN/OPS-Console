import { notFound } from "next/navigation";
import { requireMenu } from "@/features/auth/menu-guard";
import { CrumbBar } from "@/app/dashboard/_components/page-header/CrumbBar";
import { loadHandoverEditorData } from "../editor-data";
import { HandoverEditorWorkspace } from "./_components/HandoverEditorWorkspace";

/** KST YYYY-MM-DD — 메타 라인 '생성' 표기(현재 기준). */
function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
}

export default async function HandoverEditorPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const me = await requireMenu("handover");
  const { serviceId } = await params;

  const data = await loadHandoverEditorData(serviceId);
  if (!data) notFound();
  const { row, contractsStatusOptions } = data;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 표준 크럼 띠 — 목록 페이지와 동일한 위치 정체성 (요청·자료 / 인수인계) */}
      <CrumbBar pathname="/dashboard/handover" />
      <section className="flex min-h-0 flex-1 flex-col">
        <HandoverEditorWorkspace
          initialRow={row}
          contractsStatusOptions={contractsStatusOptions}
          metaItems={[
            { label: `생성 ${todayKst()}` },
            { label: me.displayName },
          ]}
        />
      </section>
    </div>
  );
}
