import { notFound } from "next/navigation";
import { requireMenu } from "@/features/auth/menu-guard";
import {
  getServiceForHandover,
  getHandoverByServiceId,
  getHandoverContactCandidates,
  listServicesWithHandover,
} from "@/features/handover/queries";
import { copyHandoverRecord } from "@/features/handover/actions";
import { listContracts } from "@/features/contracts/queries";
import { CrumbBar } from "@/app/dashboard/_components/page-header/CrumbBar";
import { derivePatternMeta } from "@/app/dashboard/_data/page-meta-derive";
import { buildEditorRow } from "./build-editor-row";
import { HandoverEditorWorkspace } from "./_components/HandoverEditorWorkspace";

export default async function HandoverEditorPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  await requireMenu("handover");
  const { serviceId } = await params;

  const service = await getServiceForHandover(serviceId);
  if (!service) notFound();

  const record = await getHandoverByServiceId(serviceId);
  const contacts = await getHandoverContactCandidates([
    service.university_name,
  ]);
  const row = buildEditorRow(
    service,
    record,
    contacts.map((c) => ({
      name: c.name,
      jobTitle: c.jobTitle,
      phone: c.phone,
      ext: c.ext,
      email: c.email,
    })),
  );

  // 복제 대상 후보 (전체 서비스 light)
  const { rows: allWithHandover } = await listServicesWithHandover({
    pageSize: 3000,
  });
  const handoverServiceCandidates = allWithHandover.map((r) => ({
    id: r.service_id,
    serviceId: r.service_number,
    universityName: r.university_name,
    serviceName: r.service_name,
    hasRecord: r.handover_status != null,
  }));

  // 계약정보 상태 셀렉트 옵션 (best-effort)
  let contractsStatusOptions: string[] = [];
  try {
    const { rows: allContracts } = await listContracts();
    contractsStatusOptions = [
      ...new Set(allContracts.map((c) => c.status).filter((v) => v.trim())),
    ];
  } catch {
    contractsStatusOptions = [];
  }

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
