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
import { BAEJUNG_CURRENT_YEAR } from "@/features/assignments/parse";
import {
  listLedgerRows,
  listAssignmentChanges,
} from "@/features/assignments/ledger-queries";
import { updateAssignment, revertChange } from "@/features/assignments/actions";
import { listOperators } from "@/features/operators/queries";
import { assignmentCandidates } from "@/features/assignments/candidates";
import { buildWorkload } from "@/features/assignments/workload";
import { workloadWindows } from "@/features/assignments/workload-sources";
import { loadWorkloadSources } from "@/features/assignments/workload-queries";
import {
  ledgerRowsToListRows,
  matchesLedgerQuery,
  isMyLedgerAssignment,
} from "./_ledger-mapper";
import { parsePricingSheet } from "@/features/assignments/pricing-parse";
import { AssignmentControls } from "./_components/AssignmentControls";
import { SheetGrid } from "./_components/SheetGrid";
import { PricingSheet } from "./_components/PricingSheet";
import {
  listProposalBatches,
  listProposals,
} from "@/features/assignments/proposal/queries";
import { ReconcileAssignments } from "./ReconcileAssignments";
import { WorkloadTable } from "./WorkloadTable";
import { ProposalPanel } from "./ProposalPanel";

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
  {
    key: "proposals",
    label: "제안",
    href: "/dashboard/assignments?tab=proposals",
  },
  {
    key: "workload",
    label: "배분현황",
    href: "/dashboard/assignments?tab=workload",
  },
] as const;

/** admin 전용 탭 — 주소를 아는 사람에게도 열려 있으면 안 되므로 탭 목록과 함께 판정한다. */
const ADMIN_TABS = new Set(["workload", "proposals"]);

/** 제안 탭이 한 화면에 그리는 배치 수. 연간 배치 하나가 300줄이라 전부 읽지 않는다. */
const PROPOSAL_BATCHES = 10;

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
  /**
   * 배분현황·제안은 **admin 전용**이다(설계 §9.5 · 사용자 결정 2026-09-17). 남의
   * 업무량을 견주고 원장을 바꾸는 자리라 열람과 편집을 가르는 것과 같은 선에 둔다.
   * 권한이 없으면 탭이 아예 안 보이고, 주소로 들어와도 `univ` 로 떨어진다 — 탭
   * 목록에서만 빼면 주소를 아는 사람에게는 열려 있는 것과 같다.
   */
  const me = await getCurrentOperator();
  const isAdmin = me?.permission === "admin";
  const requested =
    sp.tab === "duties" ||
    sp.tab === "pricing" ||
    sp.tab === "workload" ||
    sp.tab === "proposals"
      ? sp.tab
      : "univ";
  const tab = ADMIN_TABS.has(requested) && !isAdmin ? "univ" : requested;
  const tabs = isAdmin ? TABS : TABS.filter((t) => !ADMIN_TABS.has(t.key));

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
        <PageTabs active={tab} tabs={tabs} />
        {/* 이 탭들은 목록 머리가 없다 — 같은 자리(우측 상단)를 만들어 준다. */}
        <div className="flex justify-end px-7 pt-7">{sourceAction}</div>
        {body}
      </>
    );
  }

  /**
   * 배분현황 탭 — **§6.1 의 근거를 사람이 검산하는 자리**(설계 §9.4).
   *
   * 원장은 대학배정 탭과 같은 학년도를 본다. 명부는 **활성 + 배정 대상**만 —
   * 퇴사자가 0곳으로 끼면 그룹 평균이 아래로 끌려가 남은 사람이 전부 과부하로
   * 보인다(`assignable` 은 `buildWorkload` 가 거른다).
   */
  if (tab === "workload") {
    const now = new Date();
    const [ledger, operators, sources] = await Promise.all([
      listLedgerRows(BAEJUNG_CURRENT_YEAR),
      listOperators(),
      loadWorkloadSources(now),
    ]);
    const groups = buildWorkload({
      operators: operators.filter((o) => o.status === "active"),
      cells: ledger,
      serviceCounts: sources.serviceCounts,
      spans: sources.spans,
      windows: workloadWindows(now),
    });
    const people = groups.reduce((n, g) => n + g.rows.length, 0);
    return (
      <>
        {makeHeader(people)}
        <PageTabs active={tab} tabs={tabs} />
        <section className="p-7">
          <WorkloadTable groups={groups} now={now} />
        </section>
      </>
    );
  }

  /**
   * 제안 탭 — **관리자가 마지막 승인을 하는 자리**(설계 §9.3 · rev 2).
   *
   * 배치와 제안을 **페이지가 한 번에 읽어** 넘긴다. 패널이 배치마다 읽으면 화면 한
   * 장에 조회가 열 번 나고, 머리 건수와 목록이 다른 시점을 본다.
   *
   * 명부는 이름을 붙이는 데만 쓴다 — 표에 메일 주소가 그대로 서면 사람이 한 줄씩
   * 대조해야 한다. 상태로 좁히지 않는 이유는 퇴사자가 이전 담당자로 남아 있을 수
   * 있어서다(좁히면 그 칸이 주소로 돌아간다).
   */
  if (tab === "proposals") {
    const allBatches = await listProposalBatches();
    const batches = allBatches.slice(0, PROPOSAL_BATCHES);
    const [proposals, operators] = await Promise.all([
      listProposals(batches.map((b) => b.id)),
      listOperators(),
    ]);
    const names = Object.fromEntries(operators.map((o) => [o.email, o.name]));
    return (
      <>
        {makeHeader(batches.length)}
        <PageTabs active={tab} tabs={tabs} />
        <section className="p-7">
          <ProposalPanel
            batches={batches}
            proposals={proposals}
            names={names}
          />
        </section>
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

  /**
   * 이력은 **이 페이지에 뜬 대학만** 읽는다. 학년도 전체를 읽으면 편집이 쌓일수록
   * 목록 한 장을 그리는 비용이 자라고, 한 대학의 세 줄을 보여주려고 수천 줄을
   * 클라이언트로 보낸다.
   *
   * 명부는 **상태로 걸러내지 않는다.** 이력에 남은 주소를 이름으로 풀고 되돌리기
   * 가능 여부를 판정하는 기준이 '`operators` 에 있는가' 이고(FK 가 그렇다), 여기서
   * active 만 넘기면 서버 판정과 화면 판정이 갈린다.
   */
  const [changes, operators] = await Promise.all([
    listAssignmentChanges(
      BAEJUNG_CURRENT_YEAR,
      paged.map((r) => r.name),
    ),
    listOperators(),
  ]);
  // 명부 전원 — 이력의 이메일을 이름으로 풀고, 되돌리기 가능 여부를 판정한다.
  // 판정 기준이 'FK 가 받아주는가' = `operators` 에 있는가여서 여기서 좁히면 서버와 갈린다.
  const assignmentOperators = operators.map((o) => ({
    email: o.email,
    name: o.name,
  }));
  // 후보는 active 만 — **다른 질문이다**(누구를 새로 배정할 수 있나 · 정책).
  const candidates = assignmentCandidates(operators);

  /**
   * 저장 — **server action 이 폼을 믿지 않는다**(`updateAssignment` 가 이전값을 DB 에서
   * 다시 읽는다). 여기서는 화면의 행을 그쪽 입력 모양으로 옮기기만 한다.
   */
  async function onPersist(
    row: ListRow,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    // 학년도가 없으면 쓰지 않는다 — 기본값으로 메우면 다른 해에 조용히 쓴다.
    if (!row.assignment) return { ok: false, error: "학년도를 알 수 없습니다" };
    const cells = Object.entries(row.assignment.byService).flatMap(
      ([kind, rec]) =>
        (rec.cells ?? []).map((c) => ({
          work_kind: kind,
          subtype: c.subtype,
          role: c.role,
          assignee_email: c.email,
          assignee_name: c.name,
        })),
    );
    const r = await updateAssignment({
      academic_year: row.assignment.academicYear,
      university_name: row.name,
      cells,
    });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  async function onRevert(
    id: string,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const r = await revertChange(id);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  return (
    <>
      {makeHeader(total)}
      <PageTabs active="univ" tabs={tabs} />
      <ListPattern
        title="대학배정"
        data={{ rows: paged }}
        variant="assignments"
        /*
         * **admin 만 편집한다.** 원장이 원천이 된 이상 아무나 고치면 되돌릴 근거가
         * 흐려진다 — 가림은 권한이 아니라서 저장 action 이 다시 확인한다(PR4b).
         */
        readOnly={me?.permission !== "admin"}
        onPersist={onPersist}
        assignmentChanges={changes}
        assignmentOperators={assignmentOperators}
        assignmentCandidates={candidates}
        /* 되돌리기는 admin 만 — 이력 자체는 전원이 본다(총괄장이 오늘 그렇다). */
        onRevertChange={me?.permission === "admin" ? onRevert : undefined}
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
