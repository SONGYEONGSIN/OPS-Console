import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listServices, type ServicesFilter } from "@/features/services/queries";
import {
  createService,
  updateService,
  deleteService,
} from "@/features/services/actions";
import type { ServicesRow } from "@/features/services/schemas";

type Sort = "write_end_asc" | "service_id_asc" | "created_desc";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    region?: string;
    universityType?: string;
    applicationType?: string;
    solo?: string;
    mine?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const slug = "services";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta);

  const sp = await searchParams;
  const me = await getCurrentOperator();

  const filter: ServicesFilter = {
    search: sp.q,
    category: sp.category,
    region: sp.region,
    universityType: sp.universityType,
    applicationType: sp.applicationType,
    solo: sp.solo === "true" ? true : sp.solo === "false" ? false : undefined,
    ownerMe: sp.mine === "true",
    ownerEmail: sp.mine === "true" ? (me?.email ?? undefined) : undefined,
    sort: (sp.sort as Sort | undefined) ?? "write_end_asc",
    page: sp.page ? Number(sp.page) : 1,
    pageSize: 30,
  };

  const { rows: services } = await listServices(filter);
  const rows: ListRow[] = services.map(servicesRowToListRow);

  const header = (
    <PageHeader
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
    if (row.status === "deleted") {
      const result = await deleteService(row.id);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    if (isNew) {
      const result = await createService({
        service_id: row.serviceIdNum ?? 0,
        application_type: row.applicationType ?? "",
        region: row.region ?? "",
        university_name: row.universityName ?? "",
        service_name: row.serviceName ?? "",
        university_type: row.universityType ?? "",
        category: row.category ?? "",
        operator_email: row.operatorEmail ?? null,
        operator_name: row.operatorName ?? null,
        developer_email: row.developerEmail ?? null,
        developer_name: row.developerName ?? null,
        write_start_at: row.writeStartAt ?? null,
        write_end_at: row.writeEndAt ?? null,
        pay_start_at: row.payStartAt ?? null,
        pay_end_at: row.payEndAt ?? null,
        solo: row.solo ?? false,
        source: row.source ?? "folio_create",
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    const result = await updateService(row.id, {
      service_id: row.serviceIdNum,
      application_type: row.applicationType,
      region: row.region,
      university_name: row.universityName,
      service_name: row.serviceName,
      university_type: row.universityType,
      category: row.category,
      operator_email: row.operatorEmail,
      operator_name: row.operatorName,
      developer_email: row.developerEmail,
      developer_name: row.developerName,
      write_start_at: row.writeStartAt,
      write_end_at: row.writeEndAt,
      pay_start_at: row.payStartAt,
      pay_end_at: row.payEndAt,
      solo: row.solo,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="services"
      canCreate={!!me}
      createLabel="+ 신규 서비스"
      readOnly={!me}
      currentUserName={me?.displayName ?? me?.email ?? ""}
      onPersist={onPersist}
    />
  );
}

function servicesRowToListRow(r: ServicesRow): ListRow {
  return {
    id: r.id,
    name: r.service_name,
    status: "active",
    owner: r.operator_name ?? r.operator_email ?? "-",
    serviceIdNum: r.service_id,
    applicationType: r.application_type,
    region: r.region,
    universityName: r.university_name,
    serviceName: r.service_name,
    universityType: r.university_type,
    category: r.category,
    operatorEmail: r.operator_email,
    operatorName: r.operator_name,
    developerEmail: r.developer_email,
    developerName: r.developer_name,
    writeStartAt: r.write_start_at,
    writeEndAt: r.write_end_at,
    payStartAt: r.pay_start_at,
    payEndAt: r.pay_end_at,
    solo: r.solo,
    source: r.source,
    importedAt: r.imported_at,
  };
}
