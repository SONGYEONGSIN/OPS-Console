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

// Pretendard 한글 폰트 등록 (SIL OFL 1.1)
// 서버 사이드에서만 호출되므로 절대 경로로 로드
const PRETENDARD_PATH = path.join(
  process.cwd(),
  "public",
  "fonts",
  "Pretendard-Regular.ttf",
);

let fontRegistered = false;
function ensureFontRegistered() {
  if (fontRegistered) return;
  Font.register({
    family: "Pretendard",
    src: PRETENDARD_PATH,
  });
  fontRegistered = true;
}

export type BackupRequestPdfInput = {
  requesterName: string;
  requesterEmail: string;
  substituteName: string;
  substituteEmail: string;
  leaveStartDate: string | null;
  leaveEndDate: string | null;
  services: string[];
  contacts: string[];
  summaryMd: string;
  createdAt: string;
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Pretendard",
    fontSize: 11,
    padding: 40,
    lineHeight: 1.5,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#b8331e",
  },
  title: {
    fontSize: 20,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#666666",
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 9,
    color: "#666666",
    marginBottom: 4,
    letterSpacing: 1,
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
    backgroundColor: "#f4eddd",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 10,
  },
  summaryBox: {
    backgroundColor: "#f4eddd",
    padding: 12,
    borderRadius: 4,
  },
  summaryText: {
    fontSize: 11,
    lineHeight: 1.6,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#999999",
    textAlign: "center",
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
        <View style={styles.header}>
          <Text style={styles.title}>백업 요청</Text>
          <Text style={styles.subtitle}>
            발송 {formatDate(input.createdAt)} · Folio
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>요청자 / 백업자</Text>
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
          <Text style={styles.sectionLabel}>휴가 / 외근 기간</Text>
          <Text style={styles.metaValue}>{leaveRange}</Text>
        </View>

        {input.services.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>담당 서비스</Text>
            <View style={styles.chipRow}>
              {input.services.map((s, i) => (
                <Text key={`svc-${i}`} style={styles.chip}>
                  {s}
                </Text>
              ))}
            </View>
          </View>
        )}

        {input.contacts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>대학 연락처</Text>
            <View style={styles.chipRow}>
              {input.contacts.map((c, i) => (
                <Text key={`ct-${i}`} style={styles.chip}>
                  {c}
                </Text>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>백업 내용</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>{input.summaryMd}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          이 문서는 Folio에서 자동 생성되었습니다.
        </Text>
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
