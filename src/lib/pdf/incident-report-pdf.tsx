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
import { deriveFormModel } from "@/features/incident-reports/form-content";

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

export type IncidentReportPdfInput = {
  recipientUniversity: string;
  title: string;
  draftDate: string;
  authorName: string;
  approverName: string | null;
  directorName: string | null;
  ceoName: string | null;
  docNumber: string | null;
  apology: string;
  gyeongwi: string | null;
  cause: string | null;
  handling: string | null;
  prevention: string | null;
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Pretendard",
    fontSize: 10.5,
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 48,
    lineHeight: 1.6,
    color: "#15120c",
  },
  brand: {
    fontSize: 8.5,
    textAlign: "center",
    marginBottom: 18,
    color: "#6b6253",
  },
  row: {
    marginBottom: 4,
  },
  bold: {
    fontWeight: 700,
  },
  apology: {
    marginVertical: 14,
  },
  companyLine: { marginTop: 18, fontWeight: 700 },
  jeonkyeol: { fontSize: 8.5, color: "#6b6253", marginBottom: 4 },
  contact: { marginTop: 10, fontSize: 8, color: "#6b6253", lineHeight: 1.5 },
  approvalTable: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#15120c",
    borderBottomWidth: 1,
    borderBottomColor: "#15120c",
    marginTop: 28,
  },
  approvalCell: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: "#d8d2c4",
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 8.5,
    textAlign: "center",
  },
  approvalCellLast: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 8.5,
    textAlign: "center",
  },
  docNumber: {
    marginTop: 14,
    fontSize: 9,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    letterSpacing: 10,
    marginBottom: 20,
  },
  sectionH: {
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 4,
  },
  sectionBody: {
    marginBottom: 6,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    textAlign: "center",
    fontSize: 8,
    color: "#9a917f",
  },
});

export async function renderIncidentReportPdf(
  input: IncidentReportPdfInput,
): Promise<Buffer> {
  ensureFontRegistered();
  const m = deriveFormModel(input);
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand} fixed>
          {m.brandHeader}
        </Text>
        <Text style={styles.row}>수신자  {m.recipientUniversity}</Text>
        <Text style={styles.row}>참  조</Text>
        <Text style={styles.row}>제  목  {m.title}</Text>
        <Text style={styles.apology}>{m.apology}</Text>
        <Text style={styles.row}>{m.attachment}</Text>
        <Text style={styles.companyLine}>{m.companyLine}</Text>
        <Text style={styles.jeonkyeol}>전결 {m.jeonkyeolDate}</Text>
        <View style={styles.approvalTable}>
          {m.approvalLine.map((a, i) => (
            <Text
              key={a.role}
              style={
                i === m.approvalLine.length - 1
                  ? styles.approvalCellLast
                  : styles.approvalCell
              }
            >
              {a.role}
              {"\n"}
              {a.name}
            </Text>
          ))}
        </View>
        {m.docNumber ? (
          <Text style={styles.docNumber}>시행  {m.docNumber}</Text>
        ) : null}
        <View style={styles.contact}>
          {m.contactLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </View>
        <Text style={styles.footer} fixed>
          운영부 상황실 · 자동 발송 문서
        </Text>
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.reportTitle}>경 위 서</Text>
        <Text style={styles.row}>
          작 성 일 자 : {m.draftDate}      작 성 자 : {m.authorName}
        </Text>
        <Text style={[styles.row, styles.bold]}>제    목 : {m.title}</Text>
        {m.sections.map((sec) => (
          <View key={sec.no} wrap={false}>
            <Text style={styles.sectionH}>
              {sec.no}. {sec.label}
            </Text>
            <Text style={styles.sectionBody}>{sec.body}</Text>
          </View>
        ))}
        <Text style={styles.apology}>{m.closing}</Text>
        <Text style={styles.footer} fixed>
          운영부 상황실 · 자동 발송 문서
        </Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
