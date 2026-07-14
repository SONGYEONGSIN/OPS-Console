import { notFound } from "next/navigation";
import { requireMenu } from "@/features/auth/menu-guard";
import { copyHandoverRecord } from "@/features/handover/actions";
import { CrumbBar } from "@/app/dashboard/_components/page-header/CrumbBar";
import { derivePatternMeta } from "@/app/dashboard/_data/page-meta-derive";
import { loadHandoverEditorData } from "../editor-data";
import { HandoverEditorWorkspace } from "./_components/HandoverEditorWorkspace";

export default async function HandoverEditorPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  await requireMenu("handover");
  const { serviceId } = await params;

  const data = await loadHandoverEditorData(serviceId);
  if (!data) notFound();
  const { row, handoverServiceCandidates, contractsStatusOptions } = data;

  async function onCopyHandover(
    fromServiceId: string,
    toServiceIds: string[],
  ): Promise<{ ok: boolean; error?: string; copiedCount?: number }> {
    "use server";
    return await copyHandoverRecord(fromServiceId, toServiceIds);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 표준 크럼 띠 — 목록 페이지와 동일한 위치 정체성 (요청·자료 / 인수인계) */}
      <CrumbBar pathname="/dashboard/handover" />
      <section className="flex min-h-0 flex-1 flex-col">
        <HandoverEditorWorkspace
          initialRow={row}
          contractsStatusOptions={contractsStatusOptions}
          handoverServiceCandidates={handoverServiceCandidates}
          onCopyHandover={onCopyHandover}
          metaItems={derivePatternMeta(undefined, undefined)}
        />
      </section>
    </div>
  );
}
