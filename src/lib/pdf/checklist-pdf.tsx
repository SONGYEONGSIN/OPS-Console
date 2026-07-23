import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  Image as PdfImage,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";
import type {
  ChecklistRound,
  ChecklistItem,
  ItemStatus,
} from "@/features/checklist/schemas";
import { DEPARTMENTS, deptLabel } from "@/features/checklist/schemas";
import { computeCompletion } from "@/features/checklist/completion";
import {
  stripNoteHtml,
  extractNoteImages,
} from "@/features/checklist/note-html";

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

const STATUS_LABEL: Record<ItemStatus, string> = {
  done: "완료",
  in_progress: "진행중",
  todo: "작업전",
  na: "해당없음",
};
// PDF는 Tailwind 미사용 — design-tokens 색을 hex로 직접 매핑(report-pdf 동일 방식).
const STATUS_COLOR: Record<ItemStatus, string> = {
  done: "#556b2f",
  in_progress: "#d97706",
  todo: "#1a1a1a",
  na: "#999999",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Pretendard",
    fontSize: 10,
    paddingTop: 56,
    paddingBottom: 44,
    paddingHorizontal: 42,
    lineHeight: 1.5,
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
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#b8331e",
  },
  title: { fontSize: 19, fontWeight: 700, marginBottom: 5 },
  subtitle: { fontSize: 9, color: "#666" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  kpiCard: { width: "25%", paddingHorizontal: 4, marginBottom: 8 },
  kpiCardInner: {
    borderWidth: 0.5,
    borderColor: "#ddd",
    padding: 8,
    minHeight: 54,
  },
  kpiLabel: { fontSize: 8, color: "#666", marginBottom: 4 },
  kpiValue: { fontSize: 16, fontWeight: 700 },
  pct: { fontSize: 9, color: "#666", marginTop: 2, marginBottom: 16 },
  deptSection: { marginBottom: 14 },
  deptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderBottomWidth: 1.5,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 3,
    marginBottom: 6,
  },
  deptTitle: { fontSize: 12, fontWeight: 700 },
  deptMeta: { fontSize: 8, color: "#666" },
  catBlock: { marginBottom: 8 },
  catLabel: {
    fontSize: 8,
    color: "#888",
    marginBottom: 3,
    textTransform: "uppercase",
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderWidth: 0.5,
    borderColor: "#e5e5e5",
    padding: 6,
    marginBottom: -0.5,
  },
  itemMain: { flex: 1, paddingRight: 8 },
  itemTitle: { fontSize: 9.5 },
  itemNote: { fontSize: 8, color: "#888", marginTop: 1 },
  noteImage: { marginTop: 3, width: 160 },
  badge: { fontSize: 8, fontWeight: 700 },
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

function ChecklistDocument({
  round,
  items,
}: {
  round: ChecklistRound;
  items: ChecklistItem[];
}) {
  ensureFontRegistered();
  const all = computeCompletion(items);
  const period = `${round.periodStart ?? "-"} ~ ${round.periodEnd ?? "-"}`;
  const kpis: [string, number][] = [
    ["전체 항목", all.total],
    ["완료", all.done],
    ["진행중", all.inProgress],
    ["작업전", all.todo],
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View fixed style={styles.runningHeader}>
          <Text style={styles.runningHeaderLeft}>
            어플라이본부 원서접수 점검 진행 상황
          </Text>
          <Text>{round.title}</Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>{round.title}</Text>
          <Text style={styles.subtitle}>
            {period} · {round.createdBy ?? ""}
          </Text>
        </View>

        <View style={styles.kpiGrid}>
          {kpis.map(([label, n]) => (
            <View key={label} style={styles.kpiCard}>
              <View style={styles.kpiCardInner}>
                <Text style={styles.kpiLabel}>{label}</Text>
                <Text style={styles.kpiValue}>{n}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.pct}>완료율 (해당없음 제외): {all.pct}%</Text>

        {DEPARTMENTS.map((dept) => {
          const deptItems = items.filter((i) => i.department === dept);
          if (deptItems.length === 0) return null;
          const c = computeCompletion(deptItems);
          const cats = Array.from(new Set(deptItems.map((i) => i.category)));
          return (
            <View key={dept} style={styles.deptSection}>
              <View style={styles.deptHeader} minPresenceAhead={40}>
                <Text style={styles.deptTitle}>{deptLabel(dept)}</Text>
                <Text style={styles.deptMeta}>
                  {c.done}/{c.total} · {c.pct}%
                </Text>
              </View>
              {cats.map((cat) => (
                <View key={cat} style={styles.catBlock} minPresenceAhead={30}>
                  <Text style={styles.catLabel}>{cat || "(분야 없음)"}</Text>
                  {deptItems
                    .filter((i) => i.category === cat)
                    .map((i) => (
                      <View key={i.id} style={styles.itemRow} wrap={false}>
                        <View style={styles.itemMain}>
                          <Text style={styles.itemTitle}>{i.title}</Text>
                          {stripNoteHtml(i.note) ? (
                            <Text style={styles.itemNote}>
                              {stripNoteHtml(i.note)}
                            </Text>
                          ) : null}
                          {extractNoteImages(i.note).map((url) => (
                            <PdfImage
                              key={url}
                              src={url}
                              style={styles.noteImage}
                            />
                          ))}
                        </View>
                        <Text
                          style={[
                            styles.badge,
                            {
                              color: i.status
                                ? STATUS_COLOR[i.status]
                                : "#999999",
                            },
                          ]}
                        >
                          {i.status ? STATUS_LABEL[i.status] : "미지정"}
                        </Text>
                      </View>
                    ))}
                </View>
              ))}
            </View>
          );
        })}

        <View fixed style={styles.runningFooter}>
          <Text>본 체크리스트는 OPS-Console에서 자동 생성되었습니다.</Text>
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

export async function renderChecklistPdf(
  round: ChecklistRound,
  items: ChecklistItem[],
): Promise<Buffer> {
  return await renderToBuffer(
    <ChecklistDocument round={round} items={items} />,
  );
}
