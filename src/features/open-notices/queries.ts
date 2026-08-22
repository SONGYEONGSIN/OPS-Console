import "server-only";
import { createClient } from "@/lib/supabase/server";

export type OpenNoticeService = {
  serviceId: number;
  /** closing_services.operator_name — 발송 권한 판정에 쓴다 */
  operatorName: string | null;
  universityName: string;
  serviceName: string;
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
    .select("service_id, operator_name, university_name, service_name")
    .eq("service_id", serviceId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    service_id: number;
    operator_name: string | null;
    university_name: string;
    service_name: string;
  };
  return {
    serviceId: row.service_id,
    operatorName: row.operator_name,
    universityName: row.university_name,
    serviceName: row.service_name,
  };
}
