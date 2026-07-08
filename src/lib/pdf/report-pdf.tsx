import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";
import type { ReportRow } from "@/features/reports/schemas";

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
    color: "#999",
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  runningHeaderLeft: { color: "#b8331e" },
  header: {
    marginBottom: 22,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#b8331e",
  },
  title: { fontSize: 19, fontWeight: 700, marginBottom: 5 },
  subtitle: { fontSize: 9, color: "#666" },
  meta: { marginBottom: 24, padding: 12, backgroundColor: "#f4eddd" },
  metaRow: { flexDirection: "row", marginBottom: 4 },
  metaLabel: { fontSize: 9, color: "#666", width: 70 },
  metaValue: { fontSize: 10, flex: 1 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  kpiCard: {
    width: "25%",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  kpiCardInner: {
    borderWidth: 0.5,
    borderColor: "#ddd",
    padding: 8,
    minHeight: 70,
  },
  kpiLabel: { fontSize: 8, color: "#666", marginBottom: 4 },
  kpiValue: { fontSize: 16, fontWeight: 700 },
  kpiUnit: { fontSize: 8, color: "#666" },
  kpiDelta: { fontSize: 8, marginTop: 4 },
  runningFooter: {
    position: "absolute",
    bottom: 18,
    left: 42,
    right: 42,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#999",
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#ddd",
  },
});

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function arrowFor(
  delta: number | null,
  goodOnIncrease: boolean,
): { symbol: string; color: string } {
  if (delta === null || delta === 0) return { symbol: "·", color: "#999" };
  const up = delta > 0;
  const isGood = up ? goodOnIncrease : !goodOnIncrease;
  return {
    symbol: up ? "▲" : "▼",
    color: isGood ? "#b8331e" : "#888",
  };
}

function ReportDocument({ report }: { report: ReportRow }) {
  ensureFontRegistered();
  const headerLine = `${report.periodStart} ~ ${report.periodEnd}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View fixed style={styles.runningHeader}>
          <Text style={styles.runningHeaderLeft}>운영부 운영리포트</Text>
          <Text>{headerLine}</Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>{report.title}</Text>
          <Text style={styles.subtitle}>
            {headerLine} · 생성 {formatDate(report.createdAt)} · {report.createdBy}
          </Text>
        </View>

        <View style={styles.meta}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>리포트 ID</Text>
            <Text style={styles.metaValue}>{report.id}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>기간</Text>
            <Text style={styles.metaValue}>{headerLine}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>상태</Text>
            <Text style={styles.metaValue}>
              {report.status === "completed" ? "완료" : "드래프트"}
            </Text>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          {report.kpis.map((k) => {
            const arr = arrowFor(k.delta, k.goodOnIncrease);
            return (
              <View key={k.key} style={styles.kpiCard}>
                <View style={styles.kpiCardInner}>
                  <Text style={styles.kpiLabel}>{k.label}</Text>
                  <Text style={styles.kpiValue}>
                    {k.value.toLocaleString("ko-KR")}{" "}
                    <Text style={styles.kpiUnit}>{k.unit}</Text>
                  </Text>
                  {k.delta !== null ? (
                    <Text style={[styles.kpiDelta, { color: arr.color }]}>
                      {arr.symbol} {Math.abs(k.delta)}
                      {k.deltaPct !== null
                        ? ` (${k.deltaPct > 0 ? "+" : ""}${k.deltaPct}%)`
                        : ""}
                    </Text>
                  ) : (
                    <Text style={[styles.kpiDelta, { color: "#999" }]}>
                      비교 불가
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        <View fixed style={styles.runningFooter}>
          <Text>본 보고서는 OPS-Console에서 자동 생성되었습니다.</Text>
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

export async function renderReportPdf(report: ReportRow): Promise<Buffer> {
  return await renderToBuffer(<ReportDocument report={report} />);
}
