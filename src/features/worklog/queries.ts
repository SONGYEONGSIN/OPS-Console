import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  worklogRowSchema,
  type WorklogLevel,
  type WorklogRow,
} from "./schemas";
import type { LogLine } from "@/app/dashboard/_components/patterns/LogPattern";

export type ListWorklogInput = {
  q?: string;
  level?: WorklogLevel;
  domain?: string;
  /** user_email = me 본인 활동만 */
  userEmail?: string;
  page?: number;
  pageSize?: number;
};

export type ListWorklogResult = {
  rows: WorklogRow[];
  total: number;
};

const DEFAULT_PAGE_SIZE = 50;

/** server-side 페이지네이션 + 필터. created_at DESC 정렬. */
export async function listWorklog(
  input: ListWorklogInput = {},
): Promise<ListWorklogResult> {
  const supabase = await createClient();
  let q = supabase
    .from("worklog")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (input.level) q = q.eq("level", input.level);
  if (input.domain) q = q.eq("domain", input.domain);
  if (input.userEmail) q = q.eq("user_email", input.userEmail);
  if (input.q) {
    const like = `%${input.q}%`;
    q = q.or(`msg.ilike.${like},target_name.ilike.${like}`);
  }

  const page = Math.max(1, input.page ?? 1);
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  q = q.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await q;
  if (error) {
    console.error("[listWorklog]", error);
    return { rows: [], total: 0 };
  }

  const rows: WorklogRow[] = [];
  for (const row of data ?? []) {
    const r = worklogRowSchema.safeParse(row);
    if (r.success) rows.push(r.data);
    else console.error("[listWorklog] zod fail:", r.error.issues);
  }

  return { rows, total: count ?? 0 };
}

/** worklog row → LogPattern.LogLine 형식 (시간 + level + 한 줄 메시지) */
export function mapWorklogToLogLine(row: WorklogRow): LogLine {
  const user = row.user_name ?? "system";
  const target = row.target_name ? ` [${row.target_name}]` : "";
  return {
    ts: row.created_at,
    level: row.level === "DEBUG" ? "INFO" : row.level,
    msg: `${user} · ${row.domain} · ${row.action}${target} — ${row.msg}`,
  };
}
