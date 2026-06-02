import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";
import { deriveFormModel } from "@/features/incident-reports/form-content";
import type { HandlingRow } from "@/features/incident-reports/schemas";

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
const SEAL_PATH = path.join(
  process.cwd(),
  "public",
  "brand",
  "incident-report-seal.png",
);
const LOGO_PATH = path.join(
  process.cwd(),
  "public",
  "brand",
  "jinhakapply-logo.png",
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
  authorEmail: string;
  approverName: string | null;
  directorName: string | null;
  ceoName: string | null;
  docNumber: string | null;
  apology: string;
  gyeongwi: string | null;
  cause: string | null;
  handling: string | null;
  handlingRows: readonly HandlingRow[];
  prevention: string | null;
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Pretendard",
    fontSize: 10.5,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 44,
    lineHeight: 1.6,
    color: "#15120c",
  },
  frame: { borderWidth: 1, borderColor: "#15120c", padding: 22 },
  wordmark: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 4,
  },
  brand: {
    fontSize: 8.5,
    textAlign: "center",
    paddingVertical: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#15120c",
    marginBottom: 12,
    color: "#6b6253",
  },
  logo: { width: 190, height: 37, alignSelf: "center", marginBottom: 3 },
  slogan: {
    fontSize: 7.5,
    textAlign: "center",
    color: "#6b6253",
    marginBottom: 2,
  },
  logoRule: {
    borderBottomWidth: 1,
    borderBottomColor: "#15120c",
    marginTop: 2,
  },
  row: { marginBottom: 3 },
  bold: { fontWeight: 700 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#9a917f", marginVertical: 8 },
  coverList: { marginLeft: 16 },
  coverItem: { flexDirection: "row", marginBottom: 6 },
  coverNum: { width: 18 },
  coverText: { flex: 1 },
  apology: { marginTop: 4 },
  companyWrap: {
    marginTop: 28,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  companyLine: { fontSize: 15, fontWeight: 700, letterSpacing: 1 },
  seal: { position: "absolute", right: 160, top: -10, width: 44, height: 44 },
  grayBar: { height: 6, backgroundColor: "#d8d2c4", marginTop: 18 },
  jeonkyeol: {
    fontSize: 7.5,
    fontWeight: 700,
    textAlign: "right",
    marginTop: 4,
  },
  approvalRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 1 },
  approvalItem: { fontSize: 9, marginRight: 24 },
  docRow: { marginTop: 2, fontSize: 7.5 },
  contact: { marginTop: 2, fontSize: 7.5, color: "#3a3528", lineHeight: 1.5 },
  reportTitle: {
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    letterSpacing: 10,
    marginBottom: 12,
  },
  authorRow: { textAlign: "right", fontSize: 9.5, fontWeight: 700, marginBottom: 12 },
  titleCell: {
    borderWidth: 1,
    borderColor: "#15120c",
    borderBottomWidth: 0,
    padding: 8,
    fontWeight: 700,
  },
  bodyFrame: { borderWidth: 1, borderColor: "#15120c", padding: 12 },
  sectionH: { fontWeight: 700, marginTop: 10, marginBottom: 3 },
  sectionBody: { marginBottom: 4 },
  hTable: {
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#15120c",
  },
  hTr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999" },
  hHead: { backgroundColor: "#efece3" },
  hTimeCell: {
    width: 110,
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: "#999",
    fontSize: 9,
  },
  hContentCell: { flex: 1, padding: 4, fontSize: 9 },
  hCellCenter: { textAlign: "center", fontWeight: 700 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    textAlign: "center",
    fontSize: 8,
    color: "#9a917f",
  },
});

function HandlingTable({ rows }: { rows: readonly HandlingRow[] }) {
  return (
    <View style={styles.hTable}>
      <View style={[styles.hTr, styles.hHead]}>
        <Text style={[styles.hTimeCell, styles.hCellCenter]}>일시</Text>
        <Text style={[styles.hContentCell, styles.hCellCenter]}>내용</Text>
      </View>
      {rows.map((r, i) => (
        <View key={`${r.time}-${i}`} style={styles.hTr}>
          <Text style={styles.hTimeCell}>{r.time}</Text>
          <Text style={styles.hContentCell}>{r.content}</Text>
        </View>
      ))}
    </View>
  );
}

export async function renderIncidentReportPdf(
  input: IncidentReportPdfInput,
): Promise<Buffer> {
  ensureFontRegistered();
  const m = deriveFormModel(input);
  const doc = (
    <Document>
      {/* ① 공문 */}
      <Page size="A4" style={styles.page}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image는 alt 미지원 */}
        <Image style={styles.logo} src={LOGO_PATH} />
        <Text style={styles.slogan}>{m.brandHeader}</Text>
        <View style={styles.logoRule} />
        <Text style={[styles.row, { marginTop: 14 }]}>
          수신자  {m.recipientUniversity}
        </Text>
        <Text style={styles.row}>참  조</Text>
        <Text style={[styles.row, styles.bold]}>제  목  {m.title}</Text>
        <View style={styles.hr} />
        <View style={styles.coverList}>
          {m.coverBody.map((line, i) => (
            <View key={i} style={styles.coverItem}>
              <Text style={styles.coverNum}>{i + 1}.</Text>
              <Text style={styles.coverText}>{line}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.row, { marginTop: 12 }]}>
          붙임 : 1. {m.title} 경위서 1부
        </Text>
        <Text style={styles.row}>끝.</Text>

        <View style={styles.companyWrap}>
          <Text style={styles.companyLine}>{m.companyLine}</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image는 alt 미지원 */}
          <Image style={styles.seal} src={SEAL_PATH} />
        </View>

        <View style={styles.grayBar} />
        <Text style={styles.jeonkyeol}>전결 {m.jeonkyeolDate}</Text>
        <View style={styles.approvalRow}>
          {m.approvalLine
            .filter((a) => a.name)
            .map((a) => (
              <Text key={a.role} style={styles.approvalItem}>
                {a.role}  {a.name}
              </Text>
            ))}
        </View>
        <Text style={styles.docRow}>
          시 행  {m.docNumber ?? ""}        접 수 (        )
        </Text>
        <View style={styles.contact}>
          {m.contactLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </View>
        <Text style={styles.footer} fixed>
          운영부 상황실 · 자동 발송 문서
        </Text>
      </Page>

      {/* ② 경위서 본문 */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.reportTitle}>경 위 서</Text>
        <Text style={styles.authorRow}>
          작 성 일 자 : {m.draftDate}        작 성 자 : {m.authorName}
        </Text>
        <Text style={styles.titleCell}>제    목 : {m.title}</Text>
        <View style={styles.bodyFrame}>
          {m.sections.map((sec) => (
            <View key={sec.no} wrap={false}>
              <Text style={styles.sectionH}>
                {sec.no}. {sec.label}
              </Text>
              {sec.rows && sec.rows.length > 0 ? (
                <HandlingTable rows={sec.rows} />
              ) : (
                <Text style={styles.sectionBody}>{sec.body}</Text>
              )}
            </View>
          ))}
          <Text style={[styles.apology, { marginTop: 10 }]}>{m.closing}</Text>
        </View>
        <Text style={styles.footer} fixed>
          운영부 상황실 · 자동 발송 문서
        </Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
