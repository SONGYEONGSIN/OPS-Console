import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { fetchReceivablesSheet } from "@/features/receivables/queries";

/**
 * /dashboard/receivables — SharePoint Excel 미수채권 (read-only 목록 + 인스펙터).
 *
 * - Microsoft Graph API로 Excel usedRange + display text fetch
 * - 헤더 자동 감지 (메타 행 분리)
 * - 핵심 컬럼만 ListPattern variant=receivables로 표시 (청구일자/거래처/내역/금액/입금여부)
 * - 행 클릭 → 인스펙터 ReceivablesView (전체 컬럼 표시)
 * - 수정은 후속 PR (read+write)
 */
export default async function ReceivablesPage() {
  const slug = "receivables";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta);

  const sheet = await fetchReceivablesSheet();
  const rows: ListRow[] = sheet
    ? sheet.rows
        .map((_, i) => toListRow(sheet, i))
        .filter(isDataRow)
    : [];

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
    />
  );

  if (!sheet) {
    return (
      <>
        {header}
        <section className="p-7">
          <div className="border border-dashed border-vermilion-deep bg-washi-raised p-8 text-center">
            <p className="text-sm font-medium text-vermilion-deep">
              SharePoint 데이터를 불러올 수 없습니다
            </p>
            <p className="mt-2 text-xs text-muted">
              환경변수 (AZURE_AD_* / SHAREPOINT_RECEIVABLES_*) 또는 Azure AD
              앱 권한을 확인하세요. 자세한 로그는 서버 콘솔.
            </p>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <ListPattern
        title={meta.label}
        data={{ rows }}
        header={header}
        variant="receivables"
        readOnly
      />
    </>
  );
}

/**
 * Excel 헤더에서 핵심 컬럼 인덱스를 휴리스틱으로 매칭.
 * 도메인별 시트가 달라도 한국어 키워드 매칭으로 동작.
 */
function pickColumns(headers: string[]): {
  date: number;
  name: number;
  detail: number;
  amount: number;
  status: number;
  owner: number;
  remarks: number;
} {
  const find = (regex: RegExp) => headers.findIndex((h) => regex.test(h));
  return {
    date: find(/일자|날짜/),
    name: find(/거래처|학교|이름/),
    detail: find(/내역|상세/),
    amount: find(/금액/),
    status: find(/입금여부|여부|상태/),
    owner: find(/운영자|담당/),
    remarks: find(/적요|비고|메모|피드백/),
  };
}

/**
 * 합계/소계 행 필터.
 * 휴리스틱:
 * - 모든 셀 중 하나라도 '소 계 / 합 계 / 총 계 / 부분합 / 누계' 같은 합계 키워드로 시작하면 skip
 * - 청구일자 셀이 빈 행도 skip (메타·합계 모두 일자 없음)
 */
const SUMMARY_RE = /^\s*(소\s*계|합\s*계|총\s*계|부분\s*합|누\s*계|총합|합산)/;

function isDataRow(row: ListRow): boolean {
  const cells = row.receivablesCells?.textValues ?? [];
  for (const c of cells) {
    if (SUMMARY_RE.test(String(c ?? ""))) return false;
  }
  const date = (row.meta ?? "").trim();
  if (date === "") return false;
  return true;
}

function toListRow(
  sheet: NonNullable<Awaited<ReturnType<typeof fetchReceivablesSheet>>>,
  idx: number,
): ListRow {
  const cols = pickColumns(sheet.headers);
  const textRow = sheet.rowsText[idx] ?? [];
  const valuesRow = sheet.rows[idx] ?? [];
  const get = (ci: number) =>
    ci >= 0 ? textRow[ci] ?? String(valuesRow[ci] ?? "") : "";
  const statusText = get(cols.status);
  const remarksText = get(cols.remarks);
  // 입금완료 판정: 적요에 '입금완료' 명시 우선, 또는 상태 셀에서 키워드 매칭
  const isPaid =
    /입금\s*완료/.test(remarksText) ||
    (/수금|완료|입금/.test(statusText) && !/미수|미입금/.test(statusText));

  return {
    id: `r-${idx}`,
    name: get(cols.name),
    body: get(cols.detail),
    status: isPaid ? "approved" : "active",
    owner: get(cols.owner),
    author: get(cols.amount),
    meta: get(cols.date),
    receivablesCells: {
      headers: sheet.headers,
      textValues: sheet.headers.map((_, i) =>
        textRow[i] !== undefined && textRow[i] !== ""
          ? textRow[i]
          : String(valuesRow[i] ?? ""),
      ),
    },
  };
}
