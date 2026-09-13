import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { HeaderActionButton } from "@/components/common/HeaderActionButton";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { PageTabs } from "@/components/common/PageTabs";
import { ScopeChips } from "@/components/common/ScopeChips";
import { ListPagination } from "@/components/common/ListPagination";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  fetchAssignmentSheet,
  SHEET_NAMES,
} from "@/features/assignments/queries";
import {
  parseBaejungList,
  parseSimpleSheet,
  parsePims,
  joinByUniversity,
  BAEJUNG_CURRENT_YEAR,
} from "@/features/assignments/parse";
import type { AssignmentRecord } from "@/features/assignments/schemas";
import {
  univRowToListRow,
  matchesAssignmentQuery,
  isMyAssignment,
} from "./_row-mapper";
import { parsePricingSheet } from "@/features/assignments/pricing-parse";
import { AssignmentControls } from "./_components/AssignmentControls";
import { SheetGrid } from "./_components/SheetGrid";
import { PricingSheet } from "./_components/PricingSheet";
import { ImportAssignments } from "./ImportAssignments";

const PAGE_SIZE = 30;

const TABS = [
  { key: "univ", label: "대학배정", href: "/dashboard/assignments?tab=univ" },
  {
    key: "duties",
    label: "업무분장",
    href: "/dashboard/assignments?tab=duties",
  },
  {
    key: "pricing",
    label: "가격정책",
    href: "/dashboard/assignments?tab=pricing",
  },
] as const;

function ErrorBox() {
  return (
    <section className="p-7">
      <div className="border border-dashed border-vermilion-deep bg-washi-raised p-8 text-center">
        <p className="text-sm font-medium text-vermilion-deep">
          SharePoint 데이터를 불러올 수 없습니다
        </p>
        <p className="mt-2 text-xs text-muted">
          환경변수 (AZURE_AD_* / SHAREPOINT_DRIVE_ID /
          SHAREPOINT_ASSIGNMENTS_ITEM_ID) 또는 Azure AD 앱 권한을 확인하세요.
        </p>
      </div>
    </section>
  );
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    mine?: string;
    universityType?: string;
    page?: string;
  }>;
}) {
  const slug = "assignments";
  await requireMenu(slug);
  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const sp = await searchParams;
  const tab = sp.tab === "duties" || sp.tab === "pricing" ? sp.tab : "univ";

  /**
   * 원본 파일 버튼 — **목록 제목 줄** 오른쪽에 둔다.
   *
   * 처음엔 페이지 제목(`서비스사이클 — 총괄장`) 옆에 뒀는데, 표를 보는 자리와
   * 멀어 눈에 안 들어왔다(2026-09-09 지적).
   *
   * 세 탭이 모두 이 한 파일의 사본이라 **탭마다 같은 자리에 둔다** — 한 탭에만
   * 있으면 나머지에서 길이 끊긴다. 주소 해석은 워크북 창구가 한다.
   */
  const sourceAction = (
    <HeaderActionButton href="/dashboard/workbook/assignments-master">
      총괄장
    </HeaderActionButton>
  );

  // 헤더 건수는 탭/필터에 따라 달라지므로 호출 시점에 실제 값을 주입한다.
  const makeHeader = (count: number) => {
    const config = resolvePageMeta(slug, meta, count);
    return (
      <PageHeader
        key="assignments-header"
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
    );
  };

  if (tab === "duties" || tab === "pricing") {
    const sheet = await fetchAssignmentSheet(
      tab === "duties" ? SHEET_NAMES.업무분장 : SHEET_NAMES.가격정책,
    );
    const sheetRows = sheet ? Math.max(0, sheet.rowsText.length - 1) : 0;
    // pricing은 좌(원서접수)/우(PIMS) 분할 + 빈 행 기준 섹션 카드. duties는 SheetGrid 유지.
    const body = sheet ? (
      tab === "pricing" ? (
        <PricingSheet parsed={parsePricingSheet(sheet)} />
      ) : (
        <SheetGrid sheet={sheet} />
      )
    ) : (
      <ErrorBox />
    );
    return (
      <>
        {makeHeader(sheetRows)}
        <PageTabs active={tab} tabs={TABS} />
        {/* 이 탭들은 목록 머리가 없다 — 같은 자리(우측 상단)를 만들어 준다. */}
        <div className="flex justify-end px-7 pt-7">{sourceAction}</div>
        {body}
      </>
    );
  }

  // 대학배정 탭 — 5시트 병렬 fetch
  const [baejung, daehakwon, pims, sungjuk, sangdam] = await Promise.all([
    fetchAssignmentSheet(SHEET_NAMES.배정리스트),
    fetchAssignmentSheet(SHEET_NAMES.대학원),
    fetchAssignmentSheet(SHEET_NAMES.PIMS),
    fetchAssignmentSheet(SHEET_NAMES.성적산출),
    fetchAssignmentSheet(SHEET_NAMES.상담앱),
  ]);

  if (!baejung && !daehakwon && !pims && !sungjuk && !sangdam) {
    return (
      <>
        {makeHeader(0)}
        <PageTabs active="univ" tabs={TABS} />
        <ErrorBox />
      </>
    );
  }

  const recs: AssignmentRecord[] = [
    ...(baejung ? parseBaejungList(baejung) : []),
    ...(daehakwon
      ? parseSimpleSheet(daehakwon, "대학원", {
          uni: /대학명/,
          op: /^운영자$/,
          dev: /^개발자$/,
        })
      : []),
    ...(pims ? parsePims(pims) : []),
    ...(sungjuk
      ? parseSimpleSheet(sungjuk, "성적산출", {
          uni: /대학명/,
          op: /^운영자$/,
          dev: /^개발자$/,
        })
      : []),
    ...(sangdam
      ? parseSimpleSheet(sangdam, "상담앱", {
          uni: /학교명|대학명/,
          op: /^운영자$/,
          dev: /^개발자$/,
        })
      : []),
  ];

  const allRows: ListRow[] = joinByUniversity(recs).map(univRowToListRow);

  // 대분류(universityType) 옵션 — 데이터에서 unique 추출, 한글 정렬
  const universityTypeOptions = [
    ...new Set(
      allRows.map((r) => r.universityType).filter((v): v is string => !!v),
    ),
  ].sort((a, b) => a.localeCompare(b, "ko"));

  // 서버 필터: 검색(?q, 대학명·담당자 양방향) + 내 배정(?mine) + 대분류(?universityType)
  const me = await getCurrentOperator();
  const term = (sp.q ?? "").trim();
  const mine = sp.mine !== "false";
  const univType = (sp.universityType ?? "").trim();
  const filtered = allRows.filter((r) => {
    if (term && !matchesAssignmentQuery(r, term)) return false;
    if (mine && !isMyAssignment(r, me?.displayName ?? "")) return false;
    if (univType && r.universityType !== univType) return false;
    return true;
  });

  const total = filtered.length;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      {makeHeader(total)}
      <PageTabs active="univ" tabs={TABS} />
      <ListPattern
        title="대학배정"
        data={{ rows: paged }}
        variant="assignments"
        readOnly
        liveData
        controlsRow={
          <AssignmentControls
            key="assignments-controls"
            universityTypeOptions={universityTypeOptions}
          />
        }
        inlineFilters={
          <ScopeChips
            key="assignments-scope"
            total={total}
            mineLabel="내 배정"
          />
        }
        extraActionsLeft={
          <>
            {sourceAction}
            {/*
             * 이관은 **대학배정 탭에만** 둔다 — 업무분장·가격정책은 원장과 무관하다.
             * admin 에게만 보이지만 **가림은 권한이 아니라서** action 이 다시 확인한다.
             * 학년도는 `BAEJUNG_CURRENT_YEAR` 다. `currentAcademicYear()` 를 쓰면
             * 3월에 파서가 읽는 블록과 갈려 한 해 틀린 원장이 조용히 남는다.
             */}
            {me?.permission === "admin" && (
              <ImportAssignments academicYear={BAEJUNG_CURRENT_YEAR} />
            )}
          </>
        }
        footer={
          <ListPagination
            key="assignments-pagination"
            total={total}
            pageSize={PAGE_SIZE}
          />
        }
      />
    </>
  );
}
