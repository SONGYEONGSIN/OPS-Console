import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listOperators } from "@/features/operators/queries";
import { listBackupRequests } from "@/features/backup-requests/queries";
import { createBackupRequest } from "@/features/backup-requests/actions";
import { sendBackupRequestMail } from "@/features/backup-requests/mail-actions";
import type { BackupRequestRow } from "@/features/backup-requests/schemas";
import { listServices } from "@/features/services/queries";
import type { ServicesRow } from "@/features/services/schemas";
import { listContacts } from "@/features/contacts/queries";
import type { ContactRow } from "@/features/contacts/schemas";

export default async function BackupPage() {
  const slug = "backup";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta);

  const requests = await listBackupRequests();
  const ownerByEmail = await buildOwnerMap(requests);
  const rows: ListRow[] = requests.map((r) =>
    backupRequestToListRow(r, ownerByEmail, contactsById),
  );

  const me = await getCurrentOperator();

  const allOperators = await listOperators();
  const backupOperators = allOperators
    .filter((op) => op.status === "active" && op.email !== me?.email)
    .map((op) => ({ email: op.email, name: op.name }));

  // PR-2: services 카탈로그 light projection — EditForm multi-select 후보용.
  // Supabase JS는 PostgREST Max-Rows 1000 cap. chunk loop으로 전체 fetch.
  const CHUNK = 1000;
  const MAX_PAGES = 20;
  const serviceCandidatesRaw: ServicesRow[] = [];
  let totalFetched = 0;
  for (let p = 1; p <= MAX_PAGES; p++) {
    const { rows, total } = await listServices({
      sort: "service_id_asc",
      page: p,
      pageSize: CHUNK,
    });
    if (rows.length === 0) break;
    totalFetched += rows.length;
    serviceCandidatesRaw.push(...rows);
    if (totalFetched >= total) break;
    if (p * CHUNK >= total) break; // PGRST103 회피
  }
  const backupServiceCandidates = serviceCandidatesRaw.map((s) => ({
    id: s.id,
    service_id: s.service_id,
    service_name: s.service_name,
    university_name: s.university_name,
  }));

  // contacts 카탈로그 light projection — chunk fetch 동일 패턴
  const contactCandidatesRaw: ContactRow[] = [];
  let contactsFetched = 0;
  for (let p = 1; p <= MAX_PAGES; p++) {
    const { rows, total } = await listContacts({
      page: p,
      pageSize: CHUNK,
    });
    if (rows.length === 0) break;
    contactsFetched += rows.length;
    contactCandidatesRaw.push(...rows);
    if (contactsFetched >= total) break;
    if (p * CHUNK >= total) break; // PGRST103 회피
  }
  const backupContactCandidates = contactCandidatesRaw.map((c) => ({
    id: c.id,
    customer_name: c.customer_name,
    university_name: c.university_name,
  }));
  // join용 id → detail map (backupRequestToListRow에서 활용)
  const contactsById = new Map(
    backupContactCandidates.map((c) => [c.id, c] as const),
  );

  const header = (
    <PageHeader
      key="backup-header"
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
    />
  );

  async function onPersist(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    if (isNew) {
      // PR-3: services는 {service_id, substitute_email?, substitute_name?}[] 튜플 배열
      const servicesPayload = (row.backupServicesDetail ?? []).map((d) => ({
        service_id: d.id,
        substitute_email: d.substitute_email ?? null,
        substitute_name: d.substitute_name ?? null,
      }));
      const result = await createBackupRequest({
        substitute_email: row.substituteEmail ?? "",
        substitute_name: row.substituteName ?? "",
        services: servicesPayload,
        contacts: row.backupContacts ?? [],
        summary_md: row.summary ?? "",
        leave_start_date: row.leaveStartDate ?? null,
        leave_end_date: row.leaveEndDate ?? null,
      });
      if (!result.ok) return { ok: false, error: result.error };

      // 등록 성공 후 메일 발송 — atomic 아님. 실패해도 등록 자체는 보존.
      // mail_failed 시 View 인스펙터에 재발송 버튼이 노출됨.
      const mailRes = await sendBackupRequestMail({
        backup_request_id: result.row.id,
      });
      if (!mailRes.ok) {
        return {
          ok: true,
          error: `등록은 완료. 메일 발송 실패: ${mailRes.error}`,
        };
      }
      return { ok: true };
    }
    return {
      ok: false,
      error: "수정·삭제는 아직 지원되지 않습니다 (후속 PR).",
    };
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="backup"
      canCreate={!!me}
      createLabel="+ 백업 요청"
      readOnly={!me}
      currentUserName={me?.displayName ?? me?.email ?? ""}
      backupOperators={backupOperators}
      backupServiceCandidates={backupServiceCandidates}
      backupContactCandidates={backupContactCandidates}
      onPersist={onPersist}
    />
  );
}

async function buildOwnerMap(
  requests: BackupRequestRow[],
): Promise<Map<string, string>> {
  const emails = Array.from(new Set(requests.map((r) => r.requester_email)));
  if (emails.length === 0) return new Map();
  const { OPERATORS } = await import("@/features/auth/operators");
  const map = new Map<string, string>();
  for (const email of emails) {
    const op = OPERATORS.find((o) => o.email === email);
    map.set(email, op?.name ?? email.split("@")[0] ?? email);
  }
  return map;
}

function backupRequestToListRow(
  r: BackupRequestRow,
  ownerByEmail: Map<string, string>,
  contactsById: Map<
    string,
    { id: string; customer_name: string; university_name: string }
  >,
): ListRow {
  // 기존 자유 텍스트 chips는 contactsById에 없음 → detail 비어있게 됨 (표시 X)
  const backupContactsDetail = r.contacts
    .map((id) => contactsById.get(id))
    .filter(
      (c): c is { id: string; customer_name: string; university_name: string } =>
        c != null,
    );
  return {
    id: r.id,
    name: deriveTitle(r),
    status: "active",
    owner: ownerByEmail.get(r.requester_email) ?? r.requester_email,
    substituteEmail: r.substitute_email,
    substituteName: r.substitute_name,
    backupServices: r.services_detail.map((s) => s.id),
    backupServicesDetail: r.services_detail,
    backupContacts: r.contacts,
    backupContactsDetail,
    summary: r.summary_md,
    leaveStartDate: r.leave_start_date ?? null,
    leaveEndDate: r.leave_end_date ?? null,
    mailStatus: r.mail_status,
    mailSentAt: r.mail_sent_at ?? null,
    mailError: r.mail_error ?? null,
  };
}

function deriveTitle(r: BackupRequestRow): string {
  if (r.leave_start_date && r.leave_end_date) {
    return `${r.leave_start_date} ~ ${r.leave_end_date} 백업`;
  }
  return r.summary_md.slice(0, 30);
}
