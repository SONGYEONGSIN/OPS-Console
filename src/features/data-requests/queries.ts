import "server-only";
import { listServices } from "@/features/services/queries";
import { listContacts } from "@/features/contacts/queries";
import { createClient } from "@/lib/supabase/server";

export type DataRequestRecipient = {
  email: string;
  name: string;
  department: string | null;
  universityName: string;
};

type ContactLike = {
  customer_name: string;
  university_name: string;
  department_name: string | null;
  contact_email: string | null;
};

/** 이메일 보유 연락처만 수신자 후보로 변환 (순수) */
export function toRecipients(contacts: ContactLike[]): DataRequestRecipient[] {
  const out: DataRequestRecipient[] = [];
  for (const c of contacts) {
    const email = (c.contact_email ?? "").trim();
    if (!email) continue;
    out.push({
      email,
      name: c.customer_name,
      department: c.department_name,
      universityName: c.university_name,
    });
  }
  return out;
}

/** 대학명 일치 + 검색어(이름/이메일 부분일치) 필터 (순수) */
export function filterRecipients(
  recs: DataRequestRecipient[],
  universityName: string,
  term: string,
): DataRequestRecipient[] {
  const t = term.trim().toLowerCase();
  return recs.filter(
    (r) =>
      r.universityName === universityName &&
      (t === "" || r.name.toLowerCase().includes(t) || r.email.toLowerCase().includes(t)),
  );
}

export type DataRequestSendRow = { service_id: string | null; sent_at: string | null };

/** 서비스별 가장 최근 발송(sent_at) 시각 매핑 (순수) */
export function latestSentByService(rows: DataRequestSendRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (!r.service_id || !r.sent_at) continue;
    const prev = out[r.service_id];
    if (!prev || new Date(r.sent_at).getTime() > new Date(prev).getTime()) {
      out[r.service_id] = r.sent_at;
    }
  }
  return out;
}

/** 서비스 id별 최신 발송일시 (본인 발송 이력 — RLS로 created_by=me 제한) */
export async function getLastSentByServiceIds(
  serviceIds: string[],
): Promise<Record<string, string>> {
  if (serviceIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("data_request_sends")
    .select("service_id, sent_at")
    .in("service_id", serviceIds)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false });
  return latestSentByService((data ?? []) as DataRequestSendRow[]);
}

/** 본인 담당 services (operator OR developer = me). 페이지네이션(1-base) — { rows, total } */
export async function getMyDataRequestServices(meEmail: string, page = 1, pageSize = 30) {
  return listServices({ ownerEmail: meEmail, ownerMe: true, page, pageSize });
}

/** 본인 담당 대학들의 연락처 → 수신자 후보 */
export async function getRecipientsForUniversities(
  universityNames: string[],
): Promise<DataRequestRecipient[]> {
  if (universityNames.length === 0) return [];
  const { rows } = await listContacts({ universityIn: universityNames, pageSize: 1000 });
  return toRecipients(rows);
}
