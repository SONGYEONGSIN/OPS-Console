import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { HeaderActionButton } from "@/components/common/HeaderActionButton";
import { ListPattern } from "../_components/patterns/ListPattern";
import { PageTabs } from "@/components/common/PageTabs";
import { ScopeChips } from "@/components/common/ScopeChips";
import { ListPagination } from "@/components/common/ListPagination";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  fetchAssignmentSheet,
  SHEET_NAMES,
} from "@/features/assignments/queries";
import { BAEJUNG_CURRENT_YEAR } from "@/features/assignments/parse";
import { listLedgerRows } from "@/features/assignments/ledger-queries";
import {
  ledgerRowsToListRows,
  matchesLedgerQuery,
  isMyLedgerAssignment,
} from "./_ledger-mapper";
import { parsePricingSheet } from "@/features/assignments/pricing-parse";
import { AssignmentControls } from "./_components/AssignmentControls";
import { SheetGrid } from "./_components/SheetGrid";
import { PricingSheet } from "./_components/PricingSheet";
import { ReconcileAssignments } from "./ReconcileAssignments";

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

  /**
   * 대학배정 탭 — **원장이 원천이다**(PR4). 시트는 읽지 않는다.
   *
   * 시트에서 파생하면 앱에서 고친 배정이 다음 렌더에 사라지고, 두 원천이 갈렸는지는
   * 아무도 모른다. 갈림은 읽기 전용 `대조` 버튼이 드러낸다(설계 §13 R1).
   *
   * 학년도는 `BAEJUNG_CURRENT_YEAR` — 이관이 쓴 자연키의 학년도와 같아야 한다.
   * `currentAcademicYear()` 를 쓰면 3월에 한 해를 건너뛰어 목록이 통째로 빈다.
   *
   * 조회 실패는 `listLedgerRows` 가 던진다. 빈 배열로 삼키면 '배정이 없다' 로 읽혀
   * 사람이 없는 원장을 찾아 나선다.
   */
  const me = await getCurrentOperator();
  const allRows = ledgerRowsToListRows(
    await listLedgerRows(BAEJUNG_CURRENT_YEAR),
  );

  // 대분류(universityType) 옵션 — 데이터에서 unique 추출, 한글 정렬
  const universityTypeOptions = [
    ...new Set(
      allRows.map((r) => r.universityType).filter((v): v is string => !!v),
    ),
  ].sort((a, b) => a.localeCompare(b, "ko"));

  // 서버 필터: 검색(?q, 대학명·담당자 양방향) + 내 배정(?mine) + 대분류(?universityType)
  const term = (sp.q ?? "").trim();
  const mine = sp.mine !== "false";
  const univType = (sp.universityType ?? "").trim();
  const filtered = allRows.filter((r) => {
    if (term && !matchesLedgerQuery(r, term)) return false;
    // **내 배정의 단위는 이메일이다** — 이름 비교는 같은 이름이 하나 생기는 날
    // 조용히 남의 배정을 보여준다. 원장에 이메일이 이미 있다.
    if (mine && !isMyLedgerAssignment(r, me?.email ?? "")) return false;
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
        /*
         * **admin 만 편집한다.** 원장이 원천이 된 이상 아무나 고치면 되돌릴 근거가
         * 흐려진다 — 가림은 권한이 아니라서 저장 action 이 다시 확인한다(PR4b).
         */
        readOnly={me?.permission !== "admin"}
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
             * 대조는 **대학배정 탭에만** 둔다 — 업무분장·가격정책은 원장과 무관하다.
             * admin 에게만 보이지만 **가림은 권한이 아니라서** action 이 다시 확인한다.
             * 학년도는 목록과 같은 `BAEJUNG_CURRENT_YEAR` 다 — 다른 해를 견주면
             * 전 칸이 어긋난 것으로 나온다.
             */}
            {me?.permission === "admin" && (
              <ReconcileAssignments academicYear={BAEJUNG_CURRENT_YEAR} />
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
