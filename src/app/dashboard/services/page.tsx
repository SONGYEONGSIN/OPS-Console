import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ServicesControls } from "./ServicesControls";
import { ScopeChips } from "@/components/common/ScopeChips";
import { ListPagination } from "@/components/common/ListPagination";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listOperators } from "@/features/operators/queries";
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

  const { rows: services, total } = await listServices(filter);
  const rows: ListRow[] = services.map(servicesRowToListRow);
  const config = resolvePageMeta(slug, meta, total);

  // EditForm: 운영자 select 후보 (active operators 전체)
  const allOperators = await listOperators();
  const servicesOperators = allOperators
    .filter((op) => op.status === "active")
    .map((op) => ({ email: op.email, name: op.name }));

  // EditForm: 대학명 → 학교키·다음 시퀀스 매핑 (전체 services 대상)
  // service_id = 학교키(4자리) × 1000 + 시퀀스(3자리).
  // 신규 등록 시 dropdown 선택만으로 service_id 자동 부여.
  //
  // Supabase JS client는 기본 1000건 limit. pageSize 지정해도 PostgREST `Max-Rows`로
  // 1000건 cap. 전체 distinct university_name 수집을 위해 chunk fetch.
  // PostgREST는 chunk fetch 시 *partial response*를 반환할 수 있어 (range 1000건 요청에도 996건 등)
  // chunk.length < CHUNK 만으로는 종료 조건이 부정확. fetched 누적이 total에 도달할 때까지 fetch.
  const universityKeyMap = new Map<string, { key: number; maxSeq: number }>();
  const CHUNK = 1000;
  const MAX_PAGES = 20; // 안전 한도: 최대 20000건
  let totalFetched = 0;
  for (let p = 1; p <= MAX_PAGES; p++) {
    const { rows: chunk, total } = await listServices({
      sort: "service_id_asc",
      page: p,
      pageSize: CHUNK,
    });
    if (chunk.length === 0) break;
    totalFetched += chunk.length;
    for (const s of chunk) {
      const key = Math.floor(s.service_id / 1000);
      const seq = s.service_id % 1000;
      const existing = universityKeyMap.get(s.university_name);
      if (!existing || seq > existing.maxSeq) {
        universityKeyMap.set(s.university_name, { key, maxSeq: seq });
      }
    }
    if (totalFetched >= total) break;
    // PGRST103 회피: 다음 page offset이 total 초과면 fetch 안 함 (partial response 안전망)
    if (p * CHUNK >= total) break;
  }
  const servicesUniversityKeys = [...universityKeyMap.entries()].map(
    ([universityName, { key, maxSeq }]) => ({
      universityName,
      key,
      nextSeq: maxSeq + 1,
    }),
  );

  // RSC 직렬화 시 Fragment children이 array로 변환 → React 19 key 경고. 명시 key 부여
  const header = (
    <>
      <PageHeader
        key="page-header"
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <ServicesControls key="controls" />
    </>
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
      servicesOperators={servicesOperators}
      servicesUniversityKeys={servicesUniversityKeys}
      inlineFilters={<ScopeChips total={total} mineLabel="내 서비스" />}
      footer={<ListPagination total={total} pageSize={30} />}
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
