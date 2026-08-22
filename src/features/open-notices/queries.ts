import "server-only";
import { phaseOf } from "@/features/closing/phase";
import {
  deriveStatusByService,
  type MailSendStatusRow,
  type ServiceMailStatus,
} from "@/features/mail-sends/status";
import type { TestableService } from "@/features/entertest/queries";
import { createClient } from "@/lib/supabase/server";

const SERVICE_COLUMNS =
  "service_id, university_name, service_name, category, region, university_type, admission_type, operator_name, write_start_at, write_end_at, pay_start_at, pay_end_at";

/**
 * 오픈안내 목록에 담을 단계인가 (순수).
 *
 * 오픈 예정(`upcoming`) + 접수 중(`running`). 테스트 탭처럼 `upcoming` 만
 * 담으면 **토글을 못 켠 채 오픈 시각이 지난 건이 목록에서 사라져 영영 안내를
 * 못 보낸다.** 접수 중인 건은 목록에 남기되 비활성 행으로 보여준다.
 *
 * 결제까지 끝난 건(`closed`)은 뺀다 — 이제 와서 오픈 안내를 할 이유가 없다.
 */
export function isOpenNoticeTarget(
  s: { write_start_at?: string | null; pay_end_at?: string | null },
  now: Date = new Date(),
): boolean {
  return phaseOf(s, now) !== "closed";
}

/**
 * 오픈안내 대상 서비스 목록.
 *
 * `listTestableServices()` 를 쓰지 않는 이유는 그쪽이 `upcoming` 만 주기
 * 때문이다(테스트는 열기 전에 하는 일이라 그게 맞다). 여기는 범위가 다르다.
 */
export async function listOpenNoticeServices(): Promise<TestableService[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closing_services")
    .select(SERVICE_COLUMNS)
    .order("write_start_at", { ascending: true, nullsFirst: false });
  if (error || !data) return [];
  return (data as TestableService[]).filter((r) => isOpenNoticeTarget(r));
}

/**
 * 오픈안내 목록 정렬 — 작성시작 오름차순, 값 없는 건은 뒤로 (순수).
 *
 * `listTestableServices()` 는 `write_end_at` 내림차순으로 준다. 마감 임박 순이
 * 필요한 테스트 탭에는 맞지만, 오픈안내 대상은 전부 아직 안 열린 건이라 그
 * 순서면 **가장 늦게 여는 건이 1페이지**에 오고 다음 주 오픈 건이 뒷장에
 * 묻힌다. 원본 쿼리는 테스트 탭이 쓰므로 건드리지 않고 여기서 다시 세운다.
 */
export function sortForOpenNotice<T extends { write_start_at: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const at = a.write_start_at ? Date.parse(a.write_start_at) : null;
    const bt = b.write_start_at ? Date.parse(b.write_start_at) : null;
    if (at === null && bt === null) return 0;
    if (at === null) return 1;
    if (bt === null) return -1;
    return at - bt;
  });
}

/**
 * 서비스별 오픈안내 발송 상태 (본인 발송 이력 — RLS로 created_by=me 제한).
 * 키는 `String(serviceId)` — `deriveStatusByService` 가 정규화한다.
 */
export async function getOpenNoticeStatusByServiceIds(
  serviceIds: number[],
): Promise<Record<string, ServiceMailStatus>> {
  if (serviceIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("open_notice_sends")
    .select("service_id, status, scheduled_at, sent_at, created_at")
    .in("service_id", serviceIds);
  return deriveStatusByService((data ?? []) as MailSendStatusRow[]);
}

export type OpenNoticeService = {
  serviceId: number;
  /** closing_services.operator_name — 발송 권한 판정에 쓴다 */
  operatorName: string | null;
  universityName: string;
  serviceName: string;
  /** 오픈 시각 — 자동 발송 예약 시각의 **유일한 출처**. 폼에서 받지 않는다. */
  writeStartAt: string | null;
};

/**
 * 발송 권한 판정용 서비스 조회.
 *
 * **화면이 보낸 값을 믿지 않고 DB 에서 다시 읽는다.** 폼은 누구나 조작할 수
 * 있어서 담당자명을 폼에서 받으면 판정이 무의미해진다.
 * `entertest/queries.ts` 의 `findServiceAdmissionType` 이 같은 이유로 있고,
 * 그 함수를 넓히지 않고 여기 따로 두는 건 필요한 컬럼이 다르기 때문이다.
 */
export async function findOpenNoticeService(
  serviceId: number,
): Promise<OpenNoticeService | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closing_services")
    .select("service_id, operator_name, university_name, service_name, write_start_at")
    .eq("service_id", serviceId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    service_id: number;
    operator_name: string | null;
    university_name: string;
    service_name: string;
    write_start_at: string | null;
  };
  return {
    serviceId: row.service_id,
    operatorName: row.operator_name,
    universityName: row.university_name,
    serviceName: row.service_name,
    writeStartAt: row.write_start_at,
  };
}
