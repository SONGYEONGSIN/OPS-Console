import {
  getServiceForHandover,
  getHandoverByServiceId,
  getHandoverContactCandidates,
  listServicesWithHandover,
} from "@/features/handover/queries";
import { listContracts } from "@/features/contracts/queries";
import type { ListRow } from "../_components/patterns/ListPattern";
import type { EditFormProps } from "../_components/inspector/list-variants/types";
import { buildEditorRow } from "./[serviceId]/build-editor-row";

export type HandoverEditorData = {
  row: ListRow;
  handoverServiceCandidates: NonNullable<
    EditFormProps["handoverServiceCandidates"]
  >;
  contractsStatusOptions: string[];
};

/**
 * 복제 원본/대상 후보 (전체 서비스 light) — 편집기 로더와
 * 작성 탭 목록의 복제 버튼(HandoverListCopy)이 공유한다.
 */
export async function listHandoverCopyCandidates(): Promise<
  HandoverEditorData["handoverServiceCandidates"]
> {
  const { rows: allWithHandover } = await listServicesWithHandover({
    pageSize: 3000,
  });
  return allWithHandover.map((r) => ({
    id: r.service_id,
    serviceId: r.service_number,
    universityName: r.university_name,
    serviceName: r.service_name,
    hasRecord: r.handover_status != null,
  }));
}

/**
 * 인수인계 편집기 초기 데이터 로더 — 전용 페이지([serviceId])와
 * 목록(?edit=) 인라인 편집기가 공유한다. 서비스가 없으면 null.
 */
export async function loadHandoverEditorData(
  serviceId: string,
): Promise<HandoverEditorData | null> {
  const service = await getServiceForHandover(serviceId);
  if (!service) return null;

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

  const handoverServiceCandidates = await listHandoverCopyCandidates();

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

  return { row, handoverServiceCandidates, contractsStatusOptions };
}
