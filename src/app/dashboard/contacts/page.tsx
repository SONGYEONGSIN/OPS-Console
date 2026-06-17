import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { ScopeChips } from "@/components/common/ScopeChips";
import { ContactsControls } from "./ContactsControls";
import { BulkPasteContacts } from "./BulkPasteContacts";
import { contactRowToListRow } from "./_row-mapper";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listContacts, type ContactsFilter } from "@/features/contacts/queries";
import { listServices } from "@/features/services/queries";
import type { ServicesRow } from "@/features/services/schemas";
import {
  createContact,
  updateContact,
  deleteContact,
} from "@/features/contacts/actions";

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
    mine?: string;
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
  // viewer는 actions.ts에서 server-side 차단되지만 UI 가드 일관성을 위해 동일 조건 적용.
  const canEdit = me?.permission === "admin" || me?.permission === "member";

  const mine = sp.mine !== "false";

  // 대학명 자동완성 + mine 필터용 services 전수 fetch.
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
    if (p * SUGGEST_CHUNK >= total) break; // PGRST103 회피
  }

  // mine=true 시 본인 담당 services(operator_email === me)의 university_name 집합으로 필터.
  const myUniversities = mine
    ? [
        ...new Set(
          servicesForUni
            .filter((s) => s.operator_email === me?.email)
            .map((s) => s.university_name),
        ),
      ]
    : undefined;

  const filter: ContactsFilter = {
    search: sp.q,
    jobRole: sp.jobRole,
    managementGrade: sp.managementGrade,
    relationshipGrade: sp.relationshipGrade,
    customerActive: sp.customerActive,
    universityIn: myUniversities,
    sort: (sp.sort as Sort | undefined) ?? "created_desc",
    page: sp.page ? Number(sp.page) : 1,
    pageSize: PAGE_SIZE,
  };

  const { rows: contacts, total } = await listContacts(filter);
  const rows: ListRow[] = contacts.map(contactRowToListRow);
  const config = resolvePageMeta(slug, meta, total);

  const universitySet = new Set<string>();
  for (const s of servicesForUni) universitySet.add(s.university_name);
  for (const c of contacts) universitySet.add(c.university_name);
  const universityNameSuggestions = [...universitySet].sort();

  // RSC 경계로 element prop을 보낼 때 array로 직렬화되므로 각 element에 key 명시.
  const header = (
    <div key="contacts-header">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
    </div>
  );
  const controlsRow = <ContactsControls key="contacts-controls" />;

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
      controlsRow={controlsRow}
      variant="contacts"
      canCreate={canEdit}
      createLabel="+ 신규 연락처"
      extraActionsLeft={canEdit ? <BulkPasteContacts /> : undefined}
      readOnly={!canEdit}
      currentUserName={me?.displayName ?? me?.email ?? ""}
      universityNameSuggestions={universityNameSuggestions}
      inlineFilters={
        <ScopeChips key="contacts-scope" total={total} mineLabel="내 대학" />
      }
      footer={
        <ListPagination
          key="contacts-pagination"
          total={total}
          pageSize={PAGE_SIZE}
        />
      }
      onPersist={onPersist}
    />
  );
}
