import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import path from "node:path";
import type { QuoteDocument, QuoteSection } from "@/features/quotes/document-schema";
import { QUOTE_SENDER } from "@/features/quotes/sender";
import {
  recomputeDocument,
  koreanAmount,
  laborRollup,
} from "@/features/quotes/calc";

const PRETENDARD_REGULAR = path.join(
  process.cwd(),
  "public",
  "fonts",
  "Pretendard-Regular.ttf",
);
const PRETENDARD_BOLD = path.join(
  process.cwd(),
  "public",
  "fonts",
  "Pretendard-Bold.otf",
);

let fontRegistered = false;
function ensureFontRegistered() {
  if (fontRegistered) return;
  Font.register({
    family: "Pretendard",
    fonts: [
      { src: PRETENDARD_REGULAR, fontWeight: 400 },
      { src: PRETENDARD_BOLD, fontWeight: 700 },
    ],
  });
  fontRegistered = true;
}

// react-pdf는 StyleSheet에서 hex 컬러 직접 사용 (토큰 시스템 미지원)
// handover-pdf 팔레트 동일 사용: #b8331e(강조), #1a1a1a(본문), #999999(서브)
const styles = StyleSheet.create({
  page: {
    fontFamily: "Pretendard",
    fontSize: 10,
    paddingTop: 56,
    paddingBottom: 44,
    paddingHorizontal: 42,
    lineHeight: 1.6,
    color: "#1a1a1a",
  },
  runningHeader: {
    position: "absolute",
    top: 18,
    left: 42,
    right: 42,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#999999",
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#dddddd",
  },
  runningHeaderLeft: {
    color: "#b8331e",
  },
  runningHeaderRight: {
    color: "#999999",
  },
  runningFooter: {
    position: "absolute",
    bottom: 18,
    left: 42,
    right: 42,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#999999",
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#dddddd",
  },
  // 머리말 — 타이틀
  titleBlock: {
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#b8331e",
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    color: "#1a1a1a",
    letterSpacing: 10,
  },
  // 2열 헤더
  headerGrid: {
    flexDirection: "row",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  headerCol: {
    flex: 1,
  },
  headerColLeft: {
    paddingRight: 12,
    borderRightWidth: 0.5,
    borderRightColor: "#dddddd",
  },
  headerColRight: {
    paddingLeft: 12,
  },
  headerRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  headerLabel: {
    fontSize: 9,
    color: "#666666",
    width: 64,
  },
  headerValue: {
    fontSize: 10,
    color: "#1a1a1a",
    flex: 1,
  },
  headerValueBold: {
    fontSize: 10,
    color: "#1a1a1a",
    fontWeight: 700,
    flex: 1,
  },
  headerValueCost: {
    fontSize: 11,
    color: "#b8331e",
    fontWeight: 700,
    flex: 1,
  },
  // 섹션 표
  sectionBlock: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#ffffff",
    backgroundColor: "#b8331e",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 0,
  },
  sectionNote: {
    fontSize: 8,
    color: "#555555",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#dddddd",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
  },
  tableCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 9,
    color: "#1a1a1a",
  },
  tableCellHeader: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 9,
    fontWeight: 700,
    color: "#333333",
  },
  tableCellRight: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 9,
    color: "#1a1a1a",
    textAlign: "right",
  },
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#b8331e",
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: "#fafafa",
  },
  subtotalLabel: {
    fontSize: 9,
    color: "#666666",
    marginRight: 16,
  },
  subtotalValue: {
    fontSize: 9,
    fontWeight: 700,
    color: "#1a1a1a",
  },
  // 적산 블록
  rollupBlock: {
    marginTop: 6,
    marginBottom: 6,
    padding: 8,
    backgroundColor: "#f9f4ec",
    borderLeftWidth: 2,
    borderLeftColor: "#b8331e",
  },
  rollupTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: "#b8331e",
    marginBottom: 4,
  },
  rollupRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  rollupLabel: {
    fontSize: 9,
    color: "#666666",
    width: 80,
  },
  rollupValue: {
    fontSize: 9,
    color: "#1a1a1a",
    flex: 1,
    textAlign: "right",
  },
  rollupTotal: {
    fontSize: 9,
    fontWeight: 700,
    color: "#1a1a1a",
    flex: 1,
    textAlign: "right",
  },
  // 합계
  totalsBlock: {
    marginBottom: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "#b8331e",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  totalsLabel: {
    fontSize: 10,
    color: "#666666",
  },
  totalsValue: {
    fontSize: 10,
    color: "#1a1a1a",
  },
  totalsFinalLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#b8331e",
  },
  totalsFinalValue: {
    fontSize: 12,
    fontWeight: 700,
    color: "#b8331e",
  },
  koreanAmountText: {
    fontSize: 9,
    color: "#555555",
    marginTop: 4,
    textAlign: "right",
  },
  // 안내사항
  guideBlock: {
    marginBottom: 10,
  },
  guideTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: "#333333",
    marginBottom: 4,
  },
  guideLine: {
    fontSize: 8,
    color: "#555555",
    marginBottom: 2,
    paddingLeft: 4,
  },
});

function formatAmount(v: number | string | null | undefined): string {
  if (typeof v === "number") return v.toLocaleString("ko-KR");
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (!isNaN(n)) return n.toLocaleString("ko-KR");
    return v;
  }
  return "";
}

function cellValue(
  row: Record<string, string | number | null>,
  key: string,
  kind: string,
): string {
  const v = row[key];
  if (v === null || v === undefined) return "";
  if (kind === "amount" || kind === "number") return formatAmount(v);
  return String(v);
}

function SectionTable({ section }: { section: QuoteSection }) {
  const { columns, rows, kind, rates, subtotal, note } = section;

  // labor 섹션: 적산 블록 추가
  // PDF는 recomputeDocument 거친 doc을 받으므로 r.direct 필드를 재사용(단일 소스)
  const directSum = kind === "labor"
    ? rows.reduce((acc, r) => acc + (typeof r.direct === "number" ? r.direct : 0), 0)
    : 0;
  const effectiveRates = rates ?? { overhead: 1.1, techFee: 0.2 };
  const rollup = kind === "labor"
    ? laborRollup({
        direct: directSum,
        overheadRate: effectiveRates.overhead,
        techFeeRate: effectiveRates.techFee,
      })
    : null;

  return (
    <View style={styles.sectionBlock} minPresenceAhead={80}>
      <Text style={styles.sectionTitle}>{section.title}</Text>

      {/* 헤더 행 */}
      <View style={styles.tableHeader}>
        {columns.map((col) => (
          <Text key={col.key} style={styles.tableCellHeader}>
            {col.label}
          </Text>
        ))}
      </View>

      {/* 데이터 행 */}
      {rows.map((row, i) => (
        <View key={i} style={styles.tableRow}>
          {columns.map((col) => {
            const isRight = col.kind === "amount" || col.kind === "number";
            return (
              <Text
                key={col.key}
                style={isRight ? styles.tableCellRight : styles.tableCell}
              >
                {cellValue(row, col.key, col.kind)}
              </Text>
            );
          })}
        </View>
      ))}

      {/* 소계 */}
      <View style={styles.subtotalRow}>
        <Text style={styles.subtotalLabel}>소계</Text>
        <Text style={styles.subtotalValue}>{formatAmount(subtotal)}</Text>
      </View>

      {/* labor 적산 블록 */}
      {rollup && (
        <View style={styles.rollupBlock}>
          <Text style={styles.rollupTitle}>인건비 적산 내역</Text>
          <View style={styles.rollupRow}>
            <Text style={styles.rollupLabel}>직접인건비</Text>
            <Text style={styles.rollupValue}>{formatAmount(rollup.direct)}</Text>
          </View>
          <View style={styles.rollupRow}>
            <Text style={styles.rollupLabel}>제경비 ({Math.round((effectiveRates.overhead - 1) * 100)}%)</Text>
            <Text style={styles.rollupValue}>{formatAmount(rollup.overhead)}</Text>
          </View>
          <View style={styles.rollupRow}>
            <Text style={styles.rollupLabel}>기술료 ({Math.round(effectiveRates.techFee * 100)}%)</Text>
            <Text style={styles.rollupValue}>{formatAmount(rollup.techFee)}</Text>
          </View>
          <View style={styles.rollupRow}>
            <Text style={styles.rollupLabel}>인건비 합계</Text>
            <Text style={styles.rollupTotal}>{formatAmount(rollup.total)}</Text>
          </View>
        </View>
      )}

      {/* 섹션 문구 */}
      {note ? <Text style={styles.sectionNote}>※ {note}</Text> : null}
    </View>
  );
}

export type QuotePdfInput = {
  document: QuoteDocument;
  customer: string;
};

function QuoteDocument({ document: rawDoc, customer }: QuotePdfInput) {
  const doc = recomputeDocument(rawDoc);
  const { header, sections, totals, guide } = doc;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 모든 페이지 상단 고정 */}
        <View fixed style={styles.runningHeader}>
          <Text style={styles.runningHeaderLeft}>{customer} · 견적서</Text>
          <Text style={styles.runningHeaderRight}>운영부 상황실 · {QUOTE_SENDER.company}</Text>
        </View>

        {/* 제목 */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>견 적 서</Text>
        </View>

        {/* 2열 헤더 — 좌: 견적 정보 / 우: 발신자 상수 + 담당자 */}
        <View style={styles.headerGrid}>
          {/* 좌 */}
          <View style={[styles.headerCol, styles.headerColLeft]}>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>수 신</Text>
              <Text style={styles.headerValueBold}>{header.recipient}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>견적명</Text>
              <Text style={styles.headerValue}>{header.quoteName}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>접수인원</Text>
              <Text style={styles.headerValue}>{header.recipientCount}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>견적비용</Text>
              <Text style={styles.headerValueCost}>
                ₩{formatAmount(totals.total)} (VAT 포함)
              </Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>견적일자</Text>
              <Text style={styles.headerValue}>{header.quoteDate}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>유효기간</Text>
              <Text style={styles.headerValue}>{header.validUntil}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>결제조건</Text>
              <Text style={styles.headerValue}>{header.paymentTerms}</Text>
            </View>
          </View>

          {/* 우 */}
          <View style={[styles.headerCol, styles.headerColRight]}>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>법인명</Text>
              <Text style={styles.headerValueBold}>{QUOTE_SENDER.company}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>대표이사</Text>
              <Text style={styles.headerValue}>{QUOTE_SENDER.ceo}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>등록번호</Text>
              <Text style={styles.headerValue}>{QUOTE_SENDER.bizNo}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>주 소</Text>
              <Text style={styles.headerValue}>{QUOTE_SENDER.address}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>담당자</Text>
              <Text style={styles.headerValue}>{header.manager}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>전 화</Text>
              <Text style={styles.headerValue}>{header.managerTel}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>이메일</Text>
              <Text style={styles.headerValue}>{header.managerEmail}</Text>
            </View>
          </View>
        </View>

        {/* 섹션 표 */}
        {sections.map((section) => (
          <SectionTable key={section.id} section={section} />
        ))}

        {/* 합계 */}
        <View style={styles.totalsBlock} minPresenceAhead={60}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>공급가액</Text>
            <Text style={styles.totalsValue}>{formatAmount(totals.supply)} 원</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>부가세 (10%)</Text>
            <Text style={styles.totalsValue}>{formatAmount(totals.vat)} 원</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsFinalLabel}>합 계</Text>
            <Text style={styles.totalsFinalValue}>{formatAmount(totals.total)} 원</Text>
          </View>
          <Text style={styles.koreanAmountText}>
            일금 {koreanAmount(totals.total)}원정 (VAT 포함)
          </Text>
        </View>

        {/* 안내사항 */}
        {guide.length > 0 && (
          <View style={styles.guideBlock}>
            <Text style={styles.guideTitle}>■ 산출 근거 및 주의 안내사항</Text>
            {guide.map((line, i) => (
              <Text key={i} style={styles.guideLine}>
                {line}
              </Text>
            ))}
          </View>
        )}

        {/* 모든 페이지 하단 고정 */}
        <View fixed style={styles.runningFooter}>
          <Text>{QUOTE_SENDER.company}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export function renderQuotePdf(input: QuotePdfInput) {
  ensureFontRegistered();
  return <QuoteDocument {...input} />;
}
