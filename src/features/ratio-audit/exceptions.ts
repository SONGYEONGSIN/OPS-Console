import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 점검 예외 — '설정은 다르지만 합의된 정상'을 알림에서 제외한다.
 *
 * 연세대(서울) 수시 1차: 문구는 9/9 3회 공개(10:00·15:00·18:00)인데 스케줄에 18시가
 * 없다. 접수 마감이 17시라 마감 후 18시 공개는 내부 수동 진행으로 합의된 건이다.
 * 이런 건이 매 실행마다 나가면 알림이 무뎌지고 진짜 오설정이 묻힌다.
 *
 * 판정 결과(payload)에는 그대로 남기고 발송에서만 뺀다 — 예외를 잘못 등록해도
 * 이력은 보존된다. 등록은 DB 직접(관리 화면은 건수가 늘면 그때).
 */

/** 차수 없는 예외(모든 차수 적용)를 나타내는 키. */
const ANY_SEQ = "*";

export type RatioAuditExceptions = ReadonlySet<string>;

function key(serviceId: number, seq: number | string): string {
  return `${serviceId}:${seq}`;
}

export async function loadRatioAuditExceptions(): Promise<RatioAuditExceptions> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ratio_audit_exceptions")
    .select("service_id, seq");
  // 조회 실패를 삼키면 예외가 조용히 무시돼 전건이 발송된다 — 실패는 드러낸다.
  if (error) throw new Error(`[ratio-audit] 예외 조회 실패: ${error.message}`);

  return new Set(
    (data ?? []).map((r) =>
      key(r.service_id as number, (r.seq as number | null) ?? ANY_SEQ),
    ),
  );
}

export function isExcluded(
  exceptions: RatioAuditExceptions,
  serviceId: number,
  seq: number,
): boolean {
  return (
    exceptions.has(key(serviceId, seq)) ||
    exceptions.has(key(serviceId, ANY_SEQ))
  );
}
