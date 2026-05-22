import "server-only";
import { listServices } from "@/features/services/queries";
import { listContacts } from "@/features/contacts/queries";

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

/** 본인 담당 services (operator OR developer = me) */
export async function getMyDataRequestServices(meEmail: string) {
  const { rows } = await listServices({ ownerEmail: meEmail, ownerMe: true, pageSize: 1000 });
  return rows;
}

/** 본인 담당 대학들의 연락처 → 수신자 후보 */
export async function getRecipientsForUniversities(
  universityNames: string[],
): Promise<DataRequestRecipient[]> {
  if (universityNames.length === 0) return [];
  const { rows } = await listContacts({ universityIn: universityNames, pageSize: 1000 });
  return toRecipients(rows);
}
