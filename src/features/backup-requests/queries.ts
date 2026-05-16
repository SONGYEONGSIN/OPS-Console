import "server-only";
import { createClient } from "@/lib/supabase/server";
import { backupRequestRowSchema, type BackupRequestRow } from "./schemas";

/**
 * supabase 중첩 select shape:
 *   backup_request_services: [
 *     { service_id, services: { id, service_id, service_name, university_name } },
 *     ...
 *   ]
 * → services_detail 배열로 평탄화 (zod 파싱 전 transform).
 */
// PR-3: backup_request_services.substitute_email/name 추가 → join row에서 함께 select
// PR-4: note_md/contacts 추가 (서비스별 메모/연락처).
const SELECT_WITH_SERVICES =
  "*, backup_request_services(service_id, substitute_email, substitute_name, note_md, contacts, services!inner(id, service_id, service_name, university_name))";

type NestedServiceRow = {
  service_id?: unknown;
  substitute_email?: unknown;
  substitute_name?: unknown;
  note_md?: unknown;
  contacts?: unknown;
  services?: unknown;
};

function flattenServicesDetail(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  const r = row as Record<string, unknown>;
  const nested = r.backup_request_services;
  const details: unknown[] = [];
  if (Array.isArray(nested)) {
    for (const item of nested as NestedServiceRow[]) {
      if (item && typeof item.services === "object" && item.services) {
        // services 객체에 join row의 substitute_email/name/note_md/contacts 합쳐서 평탄화
        details.push({
          ...(item.services as Record<string, unknown>),
          substitute_email: item.substitute_email ?? null,
          substitute_name: item.substitute_name ?? null,
          note_md: item.note_md ?? null,
          contacts: Array.isArray(item.contacts) ? item.contacts : [],
        });
      }
    }
  }
  const { backup_request_services: _drop, ...rest } = r;
  void _drop;
  return { ...rest, services_detail: details };
}

export type ListBackupRequestsInput = {
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 30;

/**
 * 백업 요청 목록 fetch (RSC).
 * RLS: authenticated → 모든 row read 허용 (전원 가시 정책).
 * 정렬: created_at desc. pagination: ?page= URL 파라미터 기반.
 */
export async function listBackupRequests(
  input: ListBackupRequestsInput = {},
): Promise<{ rows: BackupRequestRow[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;

  const { data, error, count } = await supabase
    .from("backup_requests")
    .select(SELECT_WITH_SERVICES, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    console.error("[listBackupRequests] supabase error:", error);
    return { rows: [], total: 0 };
  }

  const parsed: BackupRequestRow[] = [];
  for (const row of data ?? []) {
    const flat = flattenServicesDetail(row);
    const r = backupRequestRowSchema.safeParse(flat);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listBackupRequests] zod parse fail:",
        r.error.issues,
        "row:",
        flat,
      );
  }
  return { rows: parsed, total: count ?? 0 };
}

/**
 * 단건 fetch (인스펙터 진입용 등). services_detail join 포함.
 */
export async function getBackupRequestById(
  id: string,
): Promise<BackupRequestRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("backup_requests")
    .select(SELECT_WITH_SERVICES)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getBackupRequestById] supabase error:", error);
    return null;
  }
  if (!data) return null;

  const flat = flattenServicesDetail(data);
  const r = backupRequestRowSchema.safeParse(flat);
  if (!r.success) {
    console.error("[getBackupRequestById] zod parse fail:", r.error.issues);
    return null;
  }
  return r.data;
}
