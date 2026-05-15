import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { ContactsControls } from "./ContactsControls";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  listContacts,
  type ContactsFilter,
} from "@/features/contacts/queries";
import { listServices } from "@/features/services/queries";
import type { ServicesRow } from "@/features/services/schemas";
import {
  createContact,
  updateContact,
  deleteContact,
} from "@/features/contacts/actions";
import type { ContactRow } from "@/features/contacts/schemas";

type Sort = "created_desc" | "customer_name_asc";
const PAGE_SIZE = 30;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    jobRole?: string;
    managementGrade?: string;
    relationshipGrade?: string;
    customerActive?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const slug = "contacts";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const sp = await searchParams;
  const me = await getCurrentOperator();

  const filter: ContactsFilter = {
    search: sp.q,
    jobRole: sp.jobRole,
    managementGrade: sp.managementGrade,
    relationshipGrade: sp.relationshipGrade,
    customerActive: sp.customerActive,
    sort: (sp.sort as Sort | undefined) ?? "created_desc",
    page: sp.page ? Number(sp.page) : 1,
    pageSize: PAGE_SIZE,
  };

  const { rows: contacts, total } = await listContacts(filter);
  const rows: ListRow[] = contacts.map(contactRowToListRow);
  const config = resolvePageMeta(slug, meta, total);

  // 대학명 자동완성 후보 — services.university_name + contacts.university_name distinct 합집합.
  // Supabase JS는 PostgREST 1000 cap이라 chunk loop으로 전체 fetch.
  const SUGGEST_CHUNK = 1000;
  const SUGGEST_MAX_PAGES = 20;
  const servicesForUni: ServicesRow[] = [];
  let suggestFetched = 0;
  for (let p = 1; p <= SUGGEST_MAX_PAGES; p++) {
    const { rows, total } = await listServices({
      sort: "service_id_asc",
      page: p,
      pageSize: SUGGEST_CHUNK,
    });
    if (rows.length === 0) break;
    suggestFetched += rows.length;
    servicesForUni.push(...rows);
    if (suggestFetched >= total) break;
  }
  const universitySet = new Set<string>();
  for (const s of servicesForUni) universitySet.add(s.university_name);
  for (const c of contacts) universitySet.add(c.university_name);
  const universityNameSuggestions = [...universitySet].sort();

  const header = (
    <>
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <ContactsControls />
    </>
  );

  async function onPersist(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    if (row.status === "deleted") {
      const result = await deleteContact(row.id);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    if (isNew) {
      const result = await createContact({
        customer_active: row.customerActive ?? "재직",
        customer_name: row.name ?? "",
        job_title: row.jobTitle ?? null,
        university_name: row.universityName ?? "",
        department_name: row.departmentName ?? null,
        job_role: row.jobRole ?? null,
        management_grade: row.managementGrade ?? null,
        relationship_grade: row.relationshipGrade ?? null,
        contact_phone: row.contactPhone ?? null,
        contact_ext: row.contactExt ?? null,
        contact_email: row.contactEmail ?? null,
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    const result = await updateContact(row.id, {
      customer_active: row.customerActive,
      customer_name: row.name,
      job_title: row.jobTitle,
      university_name: row.universityName,
      department_name: row.departmentName,
      job_role: row.jobRole,
      management_grade: row.managementGrade,
      relationship_grade: row.relationshipGrade,
      contact_phone: row.contactPhone,
      contact_ext: row.contactExt,
      contact_email: row.contactEmail,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="contacts"
      canCreate={!!me}
      createLabel="+ 신규 연락처"
      readOnly={!me}
      currentUserName={me?.displayName ?? me?.email ?? ""}
      universityNameSuggestions={universityNameSuggestions}
      footer={<ListPagination total={total} pageSize={PAGE_SIZE} />}
      onPersist={onPersist}
    />
  );
}

function contactRowToListRow(r: ContactRow): ListRow {
  return {
    id: r.id,
    name: r.customer_name,
    status: "active",
    owner: "",
    customerActive: r.customer_active,
    jobTitle: r.job_title,
    universityName: r.university_name,
    departmentName: r.department_name,
    jobRole: r.job_role,
    managementGrade: r.management_grade,
    relationshipGrade: r.relationship_grade,
    contactPhone: r.contact_phone,
    contactExt: r.contact_ext,
    contactEmail: r.contact_email,
  };
}
