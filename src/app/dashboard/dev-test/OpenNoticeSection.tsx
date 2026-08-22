import { getRecipientsForUniversities } from "@/features/data-requests/queries";
import {
  getOpenNoticeStatusByServiceIds,
  listOpenNoticeServices,
  sortForOpenNotice,
} from "@/features/open-notices/queries";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { ScopeChips } from "@/components/common/ScopeChips";
import { DevTestControls } from "./DevTestControls";

const PAGE_SIZE = 30;

/** null 제거 + 중복 제거 + 정렬한 distinct 옵션. */
function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort();
}

type Props = {
  q?: string;
  page?: string;
  category?: string;
  universityType?: string;
  admissionType?: string;
  /** ScopeChips searchParam 원본. "false"면 전체, 그 외(미지정 포함)는 내 대학. */
  mine?: string;
  /** 로그인 운영자 표시명 — services.operator_name 과 비교 */
  myName?: string | null;
  meEmail?: string | null;
  isAdmin?: boolean;
};

/**
 * 오픈안내 탭 — 오픈 예정 + 접수 중 서비스 목록 + 인스펙터 자동 발송 설정.
 *
 * 목록은 전건 보이고 **설정만** 본인 담당으로 막는다. 서버 action 이 같은
 * 판정을 다시 하므로 여기 값은 화면 표시용이다.
 */
export async function OpenNoticeSection({
  q,
  page,
  category,
  universityType,
  admissionType,
  mine: mineParam,
  myName,
  meEmail,
  isAdmin,
}: Props) {
  // 목록 범위가 테스트 탭과 달라(오픈 예정 + 접수 중) 자체 조회한다.
  const services = await listOpenNoticeServices();

  // 필터 옵션은 전체 서비스 기준 distinct (다른 탭과 동일 규칙).
  const options = {
    categoryOptions: distinct(services.map((s) => s.category)),
    universityTypeOptions: distinct(services.map((s) => s.university_type)),
    admissionTypeOptions: distinct(services.map((s) => s.admission_type)),
  };

  const mine = mineParam !== "false";
  const query = (q ?? "").trim().toLowerCase();
  const filtered = services.filter((s) => {
    if (mine && myName && s.operator_name !== myName) return false;
    if (category && s.category !== category) return false;
    if (universityType && s.university_type !== universityType) return false;
    if (admissionType && s.admission_type !== admissionType) return false;
    if (
      query &&
      !`${s.university_name} ${s.service_name}`.toLowerCase().includes(query)
    )
      return false;
    return true;
  });

  // 작성시작 오름차순 — 가장 먼저 여는 건이 앞이어야 한다.
  const sorted = sortForOpenNotice(filtered);
  const total = sorted.length;
  const pageNum = page ? Math.max(1, Number(page)) : 1;
  const paged = sorted.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);

  // 수신자·상태는 **이 페이지의 30건에 대해서만** 조회한다. 전건(275)에
  // 돌리면 275개 대학 연락처를 끌어와 행마다 RSC 로 직렬화하게 된다.
  const universities = [...new Set(paged.map((s) => s.university_name))];
  const [recipients, statusByService] = await Promise.all([
    getRecipientsForUniversities(universities),
    getOpenNoticeStatusByServiceIds(paged.map((s) => s.service_id)),
  ]);

  const byUniv = new Map<string, typeof recipients>();
  for (const r of recipients) {
    const arr = byUniv.get(r.universityName) ?? [];
    arr.push(r);
    byUniv.set(r.universityName, arr);
  }

  // 요청 시각 — 서버 컴포넌트라 요청당 한 번 읽는다.
  const now = new Date().getTime();
  const rows: ListRow[] = paged.map((s) => {
    const status = statusByService[String(s.service_id)];
    return {
      id: String(s.service_id),
      name: s.service_name,
      status: "active" as const,
      owner: s.operator_name ?? "",
      serviceIdNum: s.service_id,
      universityName: s.university_name,
      serviceName: s.service_name,
      category: s.category ?? "",
      region: s.region ?? "",
      universityType: s.university_type ?? "",
      applicationType: s.admission_type ?? "",
      operatorName: s.operator_name ?? "",
      writeStartAt: s.write_start_at,
      writeEndAt: s.write_end_at,
      openNoticeRecipients: byUniv.get(s.university_name) ?? [],
      openNoticeSender: meEmail
        ? { email: meEmail, name: myName ?? "" }
        : undefined,
      openNoticeStatus: status?.status ?? null,
      openNoticeLastSentAt: status?.lastSentAt ?? null,
      openNoticeScheduledAt: status?.scheduledAt ?? null,
      openNoticeLastFailedAt: status?.lastFailedAt ?? null,
      openNoticeCanSend: !!isAdmin || (!!myName && s.operator_name === myName),
      openNoticeOpenPassed: !!s.write_start_at && Date.parse(s.write_start_at) < now,
    };
  });

  return (
    <ListPattern
      title="오픈안내"
      data={{ rows }}
      variant="open-notice"
      readOnly
      liveData
      controlsRow={<DevTestControls {...options} />}
      inlineFilters={
        <ScopeChips key="open-notice-scope" total={total} mineLabel="내 대학" />
      }
      footer={
        <ListPagination
          key="open-notice-pagination"
          total={total}
          pageSize={PAGE_SIZE}
        />
      }
    />
  );
}
