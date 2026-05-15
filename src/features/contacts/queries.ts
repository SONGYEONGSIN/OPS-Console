import "server-only";
import { createClient } from "@/lib/supabase/server";
import { contactRowSchema, type ContactRow } from "./schemas";

export type ContactsFilter = {
  search?: string;
  jobRole?: string;
  managementGrade?: string;
  relationshipGrade?: string;
  universityName?: string;
  customerActive?: string;
  sort?: "created_desc" | "customer_name_asc";
  page?: number;
  pageSize?: number;
};

export type ContactsListResult = {
  rows: ContactRow[];
  total: number;
};

const DEFAULT_PAGE_SIZE = 30;

/**
 * contacts 목록 fetch (RSC).
 * RLS: authenticated 전원 read (viewer 포함).
 * search: customer_name OR university_name ilike.
 * 4 filter (jobRole / managementGrade / relationshipGrade / universityName) + customerActive(scope).
 */
export async function listContacts(
  filter: ContactsFilter = {},
): Promise<ContactsListResult> {
  const supabase = await createClient();
  let query = supabase.from("contacts").select("*", { count: "exact" });

  if (filter.search) {
    const term = filter.search.trim();
    if (term.length > 0) {
      query = query.or(
        `customer_name.ilike.%${term}%,university_name.ilike.%${term}%`,
      );
    }
  }

  if (filter.jobRole) query = query.eq("job_role", filter.jobRole);
  if (filter.managementGrade)
    query = query.eq("management_grade", filter.managementGrade);
  if (filter.relationshipGrade)
    query = query.eq("relationship_grade", filter.relationshipGrade);
  if (filter.universityName)
    query = query.eq("university_name", filter.universityName);
  if (filter.customerActive)
    query = query.eq("customer_active", filter.customerActive);

  const sort = filter.sort ?? "created_desc";
  if (sort === "customer_name_asc") {
    query = query.order("customer_name", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const page = Math.max(1, filter.page ?? 1);
  const pageSize = filter.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = (await query) as {
    data: unknown[] | null;
    count: number | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("[listContacts] supabase error:", error);
    return { rows: [], total: 0 };
  }

  const rows: ContactRow[] = [];
  for (const row of data ?? []) {
    const r = contactRowSchema.safeParse(row);
    if (r.success) rows.push(r.data);
    else
      console.error(
        "[listContacts] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return { rows, total: count ?? 0 };
}
