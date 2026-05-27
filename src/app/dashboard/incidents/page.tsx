import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ScopeChips } from "@/components/common/ScopeChips";
import { ListPagination } from "@/components/common/ListPagination";
import { IncidentsControls } from "./IncidentsControls";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listIncidents } from "@/features/incidents/queries";
import { incidentToListRow } from "./_row-mapper";
import {
  createIncident,
  updateIncident,
  deleteIncident,
} from "@/features/incidents/actions";
import { listServices } from "@/features/services/queries";
import { currentAcademicYear } from "@/lib/datetime";

const PAGE_SIZE = 30;

// 운영 어휘 분류. datalist이므로 자유 입력 추가 가능.
// 원서접수 운영 흐름 순: 사이트 → 작성/유의/파일/추천 → 출력/전형료 → 결제 → 경쟁률 → 수험번호 → SMS·알림톡 → PIMS → 로그인 → 기타
const CATEGORY_SUGGESTIONS = [
  "사이트",
  "원서작성",
  "유의사항",
  "전산파일",
  "추천서",
  "출력물",
  "전형료",
  "결제",
  "경쟁률",
  "수험번호",
  "SMS/알림톡",
  "로그인/회원가입",
  "기타",
] as const;

type SearchParams = {
  year?: string;
  status?: string;
  department?: string;
  q?: string;
  mine?: string;
  page?: string;
};

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const slug = "incidents";
  await requireMenu(slug);

  const params = await searchParams;
  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const me = await getCurrentOperator();
  const canEdit = me?.permission === "admin" || me?.permission === "member";

  const defaultYear = currentAcademicYear();
  const selectedYear = params.year ? Number(params.year) : defaultYear;
  const page = Math.max(1, Number(params.page) || 1);
  const mine = params.mine === "true";

  const { rows: dbRows, total } = await listIncidents({
    year: selectedYear,
    status:
      params.status && params.status !== "all" ? params.status : undefined,
    department: params.department || undefined,
    q: params.q || undefined,
    mine,
    meEmail: me?.email ?? undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const rows: ListRow[] = dbRows.map(incidentToListRow);
  const config = resolvePageMeta(slug, meta, total);

  // 학년도 selector 후보 (현 학년도 +1 ~ -5)
  const yearOptions: string[] = [];
  for (let y = defaultYear + 1; y >= defaultYear - 5; y--) {
    yearOptions.push(String(y));
  }

  // 대학명 자동완성 (services.university_name distinct) — backup 도메인 동일 패턴
  const CHUNK = 1000;
  const MAX_PAGES = 20;
  const uniNames = new Set<string>();
  let totalFetched = 0;
  for (let p = 1; p <= MAX_PAGES; p++) {
    const { rows: svc, total: svcTotal } = await listServices({
      sort: "service_id_asc",
      page: p,
      pageSize: CHUNK,
    });
    if (svc.length === 0) break;
    totalFetched += svc.length;
    for (const s of svc) uniNames.add(s.university_name);
    if (totalFetched >= svcTotal) break;
    if (p * CHUNK >= svcTotal) break;
  }
  const incidentUniversityNameSuggestions = Array.from(uniNames).sort();

  const header = (
    <div key="incidents-header">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
    </div>
  );
  const controlsRow = (
    <IncidentsControls
      key="incidents-controls"
      yearOptions={yearOptions}
      defaultYear={defaultYear}
    />
  );

  async function onPersist(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    if (row.status === "deleted") {
      const r = await deleteIncident(row.id);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    const payload = {
      year: row.incidentYear ?? currentAcademicYear(),
      university_name: row.incidentUniversityName ?? "",
      app_type: row.incidentAppType ?? "공통원서",
      category: row.incidentCategory ?? "",
      occurred_date: row.incidentOccurredDate ?? null,
      resolved_date: row.incidentResolvedDate ?? null,
      title: row.incidentTitle ?? row.name ?? "",
      cause_summary: row.incidentCauseSummary ?? null,
      root_cause: row.incidentRootCause ?? null,
      resolution: row.incidentResolution ?? null,
      prevention: row.incidentPrevention ?? null,
      department: row.incidentDepartment ?? "운영부-운영1팀",
      status: row.incidentStatus ?? "미처리",
    };
    if (isNew) {
      const r = await createIncident(payload);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    const r = await updateIncident(row.id, payload);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="incidents"
      canCreate={canEdit}
      createLabel="+ 사고 보고"
      readOnly={!canEdit}
      currentUserPermission={me?.permission ?? null}
      currentUserEmail={me?.email ?? null}
      currentUserName={me?.displayName ?? me?.email ?? ""}
      controlsRow={controlsRow}
      incidentUniversityNameSuggestions={incidentUniversityNameSuggestions}
      incidentCategorySuggestions={CATEGORY_SUGGESTIONS}
      inlineFilters={
        <ScopeChips key="incidents-scope" total={total} mineLabel="내 사고" />
      }
      footer={
        <ListPagination
          key="incidents-pagination"
          total={total}
          pageSize={PAGE_SIZE}
        />
      }
      onPersist={canEdit ? onPersist : undefined}
    />
  );
}
