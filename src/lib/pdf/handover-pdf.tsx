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
import { HANDOVER_CATEGORIES, type HandoverFieldKey } from "@/features/handover/categories";

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

export type HandoverPdfFields = Record<HandoverFieldKey, string | null>;

export type HandoverPdfInput = {
  universityName: string;
  serviceName: string;
  applicationType: string;
  fromName: string;
  fromEmail: string;
  toName: string;
  toEmail: string;
  notes: string | null;
  createdAt: string;
  fields: HandoverPdfFields;
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Pretendard",
    fontSize: 10,
    paddingTop: 56, // fixed top header 공간
    paddingBottom: 44, // fixed footer 공간
    paddingHorizontal: 42,
    lineHeight: 1.6,
    color: "#1a1a1a",
  },
  // 모든 페이지 상단 고정 — 컨텍스트 유지 (서비스명)
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
  header: {
    marginBottom: 22,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#b8331e",
  },
  title: {
    fontSize: 19,
    fontWeight: 700,
    marginBottom: 5,
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 9,
    color: "#666666",
  },
  metaSection: {
    marginBottom: 24,
    padding: 12,
    backgroundColor: "#f4eddd",
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 9,
    color: "#666666",
    width: 70,
  },
  metaValue: {
    fontSize: 10,
    color: "#1a1a1a",
    flex: 1,
  },
  // 카테고리 — 페이지 break 시 헤더만 외롭게 끝에 남지 않도록 minPresenceAhead
  category: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#ffffff",
    backgroundColor: "#b8331e",
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  // 필드 — 좌측 보더로 구조 시각화
  field: {
    marginBottom: 14,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "#eeeeee",
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#b8331e",
    marginBottom: 5,
  },
  fieldValue: {
    fontSize: 10,
    lineHeight: 1.7,
    color: "#1a1a1a",
  },
  fieldEmpty: {
    fontSize: 9,
    color: "#bbbbbb",
  },
  notesBox: {
    marginTop: 14,
    padding: 10,
    backgroundColor: "#fafafa",
    borderLeftWidth: 3,
    borderLeftColor: "#b8331e",
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#b8331e",
    marginBottom: 5,
  },
  notesText: {
    fontSize: 10,
    lineHeight: 1.7,
  },
  // 모든 페이지 하단 고정
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

function HandoverDocument(input: HandoverPdfInput) {
  const headerLine = `${input.universityName} · ${input.serviceName}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* fixed: 모든 페이지 상단 컨텍스트 (서비스명) */}
        <View fixed style={styles.runningHeader}>
          <Text style={styles.runningHeaderLeft}>{headerLine}</Text>
          <Text style={styles.runningHeaderRight}>운영부 상황실 · 인수인계</Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>
            인수인계 — {input.universityName} · {input.serviceName}
          </Text>
          <Text style={styles.subtitle}>
            {input.applicationType} · 발송 {formatDate(input.createdAt)} · 운영부 상황실
          </Text>
        </View>

        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>인계자</Text>
            <Text style={styles.metaValue}>
              {input.fromName} ({input.fromEmail})
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>인수자</Text>
            <Text style={styles.metaValue}>
              {input.toName} ({input.toEmail})
            </Text>
          </View>
        </View>

        {HANDOVER_CATEGORIES.map((cat) => (
          <View
            key={cat.key}
            style={styles.category}
            // 카테고리 헤더 + 본문 최소 100pt 함께 진입 — 헤더만 외롭게 끝에 남지 않게
            minPresenceAhead={100}
          >
            <Text style={styles.categoryTitle}>{cat.label}</Text>
            {cat.fields.map((f) => {
              const v = input.fields[f.key];
              const text = (v ?? "").trim();
              return (
                <View key={f.key} style={styles.field}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  {text ? (
                    <Text style={styles.fieldValue}>{text}</Text>
                  ) : (
                    <Text style={styles.fieldEmpty}>(미작성)</Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {input.notes && (
          <View style={styles.notesBox} minPresenceAhead={60}>
            <Text style={styles.notesLabel}>인계 메모</Text>
            <Text style={styles.notesText}>{input.notes}</Text>
          </View>
        )}

        {/* fixed: 모든 페이지 하단 (페이지 번호 + 자동발송) */}
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

export async function renderHandoverPdf(
  input: HandoverPdfInput,
): Promise<Buffer> {
  ensureFontRegistered();
  return await renderToBuffer(<HandoverDocument {...input} />);
}
