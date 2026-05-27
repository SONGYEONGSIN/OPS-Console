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

export type IncidentPdfInput = {
  year: number;
  universityName: string | null;
  appType: string;
  category: string;
  title: string;
  occurredDate: string | null;
  resolvedDate: string | null;
  causeSummary: string | null;
  rootCause: string | null;
  resolution: string | null;
  prevention: string | null;
  department: string;
  assigneeName: string;
  assigneeEmail: string;
  reporterName: string;
  reporterEmail: string;
  status: string;
  createdAt: string;
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Pretendard",
    fontSize: 11,
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
  runningHeaderLeft: { color: "#b8331e" },
  runningHeaderRight: { color: "#999999" },
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
  header: {
    marginBottom: 22,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#b8331e",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: "#666666",
  },
  section: {
    marginBottom: 18,
  },
  sectionLabelChip: {
    fontSize: 12,
    fontWeight: 700,
    color: "#ffffff",
    backgroundColor: "#b8331e",
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 6,
  },
  metaItem: {
    flexDirection: "row",
    gap: 6,
  },
  metaLabel: {
    color: "#666666",
  },
  metaValue: {
    color: "#1a1a1a",
  },
  bodyBox: {
    borderLeftWidth: 2,
    borderLeftColor: "#b8331e",
    paddingLeft: 12,
    paddingVertical: 4,
  },
  bodyText: {
    fontSize: 11,
    lineHeight: 1.7,
  },
  bodyEmpty: {
    fontSize: 10,
    color: "#999999",
  },
});

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function IncidentDocument(input: IncidentPdfInput) {
  const dateRange = (() => {
    if (input.occurredDate && input.resolvedDate) {
      return `${input.occurredDate} ~ ${input.resolvedDate}`;
    }
    if (input.occurredDate) return `${input.occurredDate} ~`;
    return "미지정";
  })();

  const sections: Array<{ label: string; value: string | null }> = [
    { label: "사고경위", value: input.causeSummary },
    { label: "사고원인", value: input.rootCause },
    { label: "사고처리", value: input.resolution },
    { label: "사고대책", value: input.prevention },
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View fixed style={styles.runningHeader}>
          <Text style={styles.runningHeaderLeft}>사고보고 · {input.title}</Text>
          <Text style={styles.runningHeaderRight}>
            운영부 상황실 · 사고보고
          </Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>사고보고</Text>
          <Text style={styles.subtitle}>
            발송 {formatDate(input.createdAt)} · 운영부 상황실
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabelChip}>사고 개요</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>제목</Text>
              <Text style={styles.metaValue}>{input.title}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>구분</Text>
              <Text style={styles.metaValue}>{input.appType}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>카테고리</Text>
              <Text style={styles.metaValue}>{input.category}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>연도</Text>
              <Text style={styles.metaValue}>{String(input.year)}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>대학명</Text>
              <Text style={styles.metaValue}>
                {input.universityName ?? "미지정"}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>기간</Text>
              <Text style={styles.metaValue}>{dateRange}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>현재상황</Text>
              <Text style={styles.metaValue}>{input.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabelChip}>담당 / 보고</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>담당부서</Text>
              <Text style={styles.metaValue}>{input.department}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>담당자</Text>
              <Text style={styles.metaValue}>
                {input.assigneeName} ({input.assigneeEmail})
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>보고자</Text>
              <Text style={styles.metaValue}>
                {input.reporterName} ({input.reporterEmail})
              </Text>
            </View>
          </View>
        </View>

        {sections.map((s) => (
          <View key={s.label} style={styles.section}>
            <Text style={styles.sectionLabelChip} minPresenceAhead={40}>
              {s.label}
            </Text>
            {s.value ? (
              <View style={styles.bodyBox}>
                <Text style={styles.bodyText}>{s.value}</Text>
              </View>
            ) : (
              <Text style={styles.bodyEmpty}>(작성된 내용 없음)</Text>
            )}
          </View>
        ))}

        <View fixed style={styles.runningFooter}>
          <Text>운영부 상황실 자동발송</Text>
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

export async function renderIncidentPdf(
  input: IncidentPdfInput,
): Promise<Buffer> {
  ensureFontRegistered();
  return await renderToBuffer(IncidentDocument(input));
}
