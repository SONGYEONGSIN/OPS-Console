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

// Pretendard 한글 폰트 등록 (SIL OFL 1.1) — Regular + Bold 다중 weight
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

/**
 * PR-2: services는 join 결과 — 대학명·서비스명 정규화 표기에 사용.
 * PR-5: contacts는 contactDetailSchema 객체 배열. PDF chip에 이름 + 이메일·전화 한 줄 표시.
 */
export type PdfContactDetail = {
  contact_id: string;
  customer_name: string;
  university_name: string;
  email: string | null;
  phone: string | null;
};

export type PdfServiceDetail = {
  id: string;
  service_id: number;
  service_name: string;
  university_name: string;
  contacts: PdfContactDetail[];
  note_md: string | null;
};

export type BackupRequestPdfInput = {
  requesterName: string;
  requesterEmail: string;
  substituteName: string;
  substituteEmail: string;
  leaveStartDate: string | null;
  leaveEndDate: string | null;
  services: PdfServiceDetail[];
  summaryMd: string;
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
  // 모든 페이지 상단/하단 fixed
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
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#b8331e",
    backgroundColor: "#b8331e",
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  // 운영부 상황실 배지형 sectionLabel (위 sectionLabel 사용, 흰 글씨)
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
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#dddddd",
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
  },
  serviceCard: {
    borderWidth: 1,
    borderColor: "#eeeeee",
    padding: 12,
    marginBottom: 10,
  },
  serviceHeader: {
    fontSize: 12,
    fontWeight: 700,
    color: "#1a1a1a",
    marginBottom: 6,
  },
  serviceMetaLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#b8331e",
    marginTop: 6,
    marginBottom: 4,
  },
  noteBox: {
    borderLeftWidth: 2,
    borderLeftColor: "#b8331e",
    paddingLeft: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  noteText: {
    fontSize: 10,
    lineHeight: 1.7,
    color: "#444444",
  },
  summaryBox: {
    borderLeftWidth: 2,
    borderLeftColor: "#b8331e",
    paddingLeft: 12,
    paddingVertical: 4,
  },
  summaryText: {
    fontSize: 11,
    lineHeight: 1.7,
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

function BackupRequestDocument(input: BackupRequestPdfInput) {
  const leaveRange =
    input.leaveStartDate && input.leaveEndDate
      ? `${input.leaveStartDate} ~ ${input.leaveEndDate}`
      : input.leaveStartDate
        ? `${input.leaveStartDate} ~`
        : "미지정";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 모든 페이지 상단 fixed: 컨텍스트 유지 */}
        <View fixed style={styles.runningHeader}>
          <Text style={styles.runningHeaderLeft}>
            백업 요청 · {input.requesterName}
          </Text>
          <Text style={styles.runningHeaderRight}>운영부 상황실 · 백업 요청</Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>백업 요청</Text>
          <Text style={styles.subtitle}>
            발송 {formatDate(input.createdAt)} · 운영부 상황실
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabelChip}>요청자 / 백업자</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>요청자</Text>
              <Text style={styles.metaValue}>
                {input.requesterName} ({input.requesterEmail})
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>백업자</Text>
              <Text style={styles.metaValue}>
                {input.substituteName} ({input.substituteEmail})
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabelChip}>휴가 / 외근 기간</Text>
          <Text style={styles.metaValue}>{leaveRange}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabelChip} minPresenceAhead={40}>
            공통 메모
          </Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>{input.summaryMd}</Text>
          </View>
        </View>

        {input.services.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabelChip} minPresenceAhead={40}>
              담당 서비스
            </Text>
            {input.services.map((s) => (
              <View key={`svc-${s.id}`} style={styles.serviceCard}>
                <Text style={styles.serviceHeader}>
                  {`${s.university_name} — ${s.service_name}`}
                </Text>
                {s.contacts.length > 0 && (
                  <>
                    <Text style={styles.serviceMetaLabel}>연락처</Text>
                    <View style={styles.chipRow}>
                      {s.contacts.map((c) => {
                        const meta = [c.email, c.phone].filter(Boolean).join(" · ");
                        const label = `${c.university_name} — ${c.customer_name}${meta ? `  ${meta}` : ""}`;
                        return (
                          <Text key={`ct-${s.id}-${c.contact_id}`} style={styles.chip}>
                            {label}
                          </Text>
                        );
                      })}
                    </View>
                  </>
                )}
                {s.note_md && (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteText}>{s.note_md}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 모든 페이지 하단 fixed */}
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

/**
 * 서버 사이드에서 PDF Buffer 생성.
 * Microsoft Graph sendMail attachments의 contentBytes(base64)로 사용.
 */
export async function renderBackupRequestPdf(
  input: BackupRequestPdfInput,
): Promise<Buffer> {
  ensureFontRegistered();
  return await renderToBuffer(BackupRequestDocument(input));
}
