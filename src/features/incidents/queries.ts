import "server-only";
import { createClient } from "@/lib/supabase/server";
import { incidentRowSchema, type IncidentRow } from "./schemas";

export type ListIncidentsInput = {
  year?: number;
  status?: string;
  department?: string;
  q?: string;
  mine?: boolean;
  meEmail?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 30;

export async function listIncidents(
  input: ListIncidentsInput = {},
): Promise<{ rows: IncidentRow[]; total: number }> {
  const supabase = await createClient();
  let q = supabase
    .from("incidents")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (input.year != null) q = q.eq("year", input.year);
  if (input.status) q = q.eq("status", input.status);
  if (input.department) q = q.eq("department", input.department);
  if (input.mine && input.meEmail) q = q.eq("assignee_email", input.meEmail);
  if (input.q) {
    const like = `%${input.q}%`;
    q = q.or(
      `title.ilike.${like},university_name.ilike.${like},cause_summary.ilike.${like},assignee_name.ilike.${like}`,
    );
  }

  const page = Math.max(1, input.page ?? 1);
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  q = q.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await q;
  if (error) {
    console.error("[listIncidents] supabase error:", error);
    return { rows: [], total: 0 };
  }

  const rows: IncidentRow[] = [];
  for (const r of data ?? []) {
    const parsed = incidentRowSchema.safeParse(r);
    if (parsed.success) rows.push(parsed.data);
    else
      console.error(
        "[listIncidents] zod parse fail:",
        parsed.error.issues,
        "row:",
        r,
      );
  }
  return { rows, total: count ?? 0 };
}

export async function getIncidentById(
  id: string,
): Promise<IncidentRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getIncidentById] supabase error:", error);
    return null;
  }
  if (!data) return null;

  const parsed = incidentRowSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[getIncidentById] zod parse fail:", parsed.error.issues);
    return null;
  }
  return parsed.data;
}
