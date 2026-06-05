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
import {
  deriveFormModel,
  bodyLines,
} from "@/features/incident-reports/form-content";
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
  "jinhakapply-logo-v2.jpg",
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
  authorPhone: string | null;
  approverName: string | null;
  approverRole: string | null;
  directorName: string | null;
  directorRole: string | null;
  ceoName: string | null;
  ceoRole: string | null;
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
    // 실제 공문 여백: 위 1cm / 아래 1cm / 왼 1.8cm / 오른 2cm (1cm≈28.3pt)
    paddingTop: 28,
    paddingBottom: 28,
    paddingLeft: 51,
    paddingRight: 57,
    lineHeight: 1.625,
    color: "#15120c",
  },
  spacer: { flexGrow: 1 },
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
  logo: { width: 158, height: 30, alignSelf: "center", marginBottom: 3 },
  slogan: {
    fontSize: 7.5,
    textAlign: "center",
    color: "#6b6253",
    letterSpacing: 1.6,
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
  coverList: { marginLeft: 16, marginTop: 28 },
  attachLine: { marginLeft: 16 },
  coverItem: { flexDirection: "row", marginBottom: 18 },
  coverNum: { width: 18 },
  coverText: { flex: 1, lineHeight: 1.35, textAlign: "justify" },
  apology: { marginTop: 4 },
  companyWrap: {
    marginTop: 36,
    height: 30,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  companyLine: { fontSize: 18, fontWeight: 700, letterSpacing: 1 },
  seal: { position: "absolute", right: 128, top: -16, width: 63, height: 63 },
  grayBar: { height: 7, backgroundColor: "#cfc9bb", marginTop: 40 },
  jeonkyeol: {
    fontSize: 9,
    fontWeight: 700,
    textAlign: "right",
    marginTop: 8,
  },
  approvalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  approvalItem: { fontSize: 10 },
  docRowWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  docRow: { fontSize: 9 },
  contact: {
    marginTop: 8,
    fontSize: 9,
    color: "#3a3528",
    lineHeight: 1.9,
    letterSpacing: 1,
  },
  contactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  contactSep: { color: "#9a917f" },
  reportTitle: {
    fontSize: 26,
    fontWeight: 700,
    textAlign: "center",
    letterSpacing: 12,
    marginTop: 8,
    marginBottom: 22,
  },
  authorRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    fontSize: 9.5,
    fontWeight: 700,
    marginBottom: 6,
  },
  authorName: { marginLeft: 30 },
  titleCell: {
    borderWidth: 1,
    borderColor: "#15120c",
    borderBottomWidth: 0,
    padding: 8,
    fontWeight: 700,
  },
  bodyFrame: {
    borderWidth: 1,
    borderColor: "#15120c",
    paddingTop: 20,
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexGrow: 1,
    // 세로 밸런스 — 내용 분량과 무관하게 면을 고르게 채움
    justifyContent: "space-between",
  },
  sectionH: { fontWeight: 700, marginTop: 10, marginBottom: 3 },
  sectionBodyWrap: { marginTop: 2, marginLeft: 8 },
  sectionBodyIndent: { marginLeft: 14 },
  hTable: {
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#15120c",
  },
  hTr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#999",
    alignItems: "flex-start",
  },
  hHead: { backgroundColor: "#efece3" },
  hTimeCell: {
    width: 110,
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: "#999",
    fontSize: 9,
    textAlign: "center",
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

/** 섹션 본문 — 줄 단위. '-' 세부 항목 들여쓰기, 양쪽정렬 없이 자연 줄바꿈. */
function SectionBody({ body }: { body: string }) {
  return (
    <View style={styles.sectionBodyWrap}>
      {bodyLines(body).map((ln, i) => (
        <Text key={i} style={ln.indent ? styles.sectionBodyIndent : undefined}>
          {ln.text || " "}
        </Text>
      ))}
    </View>
  );
}

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
          수신자　　{m.recipientUniversity}
        </Text>
        <Text style={styles.row}>참　조</Text>
        <Text style={[styles.row, styles.bold]}>제　목　　{m.title}</Text>
        <View style={styles.hr} />
        <View style={styles.coverList}>
          {m.coverBody.map((line, i) => (
            <View key={i} style={styles.coverItem}>
              <Text style={styles.coverNum}>{i + 1}.</Text>
              <Text style={styles.coverText}>{line}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.row, styles.attachLine, { marginTop: 24 }]}>
          붙임 : 1. {m.title} 경위서 1부
        </Text>
        <Text style={[styles.row, styles.attachLine]}>끝.</Text>

        {/* 세로 분산 — 공문이 A4 한 면을 꽉 채우도록 */}
        <View style={styles.spacer} />

        <View style={styles.companyWrap}>
          {/* 직인 먼저(뒤), 회사명 나중(앞) → 글자가 직인 위로 */}
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image는 alt 미지원 */}
          <Image style={styles.seal} src={SEAL_PATH} />
          <Text style={styles.companyLine}>{m.companyLine}</Text>
        </View>

        <View style={styles.grayBar} />
        <Text style={styles.jeonkyeol}>전결 {m.jeonkyeolDate}</Text>
        <View style={styles.approvalRow}>
          {m.approvalLine
            .filter((a) => a.name)
            .map((a) => (
              <Text key={a.role} style={styles.approvalItem}>
                {a.role} {a.name}
              </Text>
            ))}
        </View>
        <View style={styles.docRowWrap}>
          <Text style={styles.docRow}>
            시 행{" "}
            {m.docNumber ? `${m.docNumber} (${m.receiptDate})` : "(자동 채번)"}
          </Text>
          <Text style={styles.docRow}>접 수 ( )</Text>
        </View>
        <View style={styles.contact}>
          {m.contactLines.map((line) => {
            const segs = line.split("ㅣ").map((s) => s.trim());
            const items: { text: string; sep: boolean }[] = [];
            segs.forEach((seg, i) => {
              items.push({ text: seg, sep: false });
              if (i < segs.length - 1) items.push({ text: "ㅣ", sep: true });
            });
            return (
              <View key={line} style={styles.contactRow}>
                {items.map((it, i) => (
                  <Text key={i} style={it.sep ? styles.contactSep : undefined}>
                    {it.text}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      </Page>

      {/* ② 경위서 본문 */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.reportTitle}>경 위 서</Text>
        <View style={styles.authorRow}>
          <Text>작 성 일 자 : {m.draftDate}</Text>
          <Text style={styles.authorName}>작 성 자 : {m.authorName}</Text>
        </View>
        <Text style={styles.titleCell}>제 목 : {m.title}</Text>
        <View style={styles.bodyFrame}>
          {m.sections.map((sec) => (
            <View key={sec.no} wrap={false}>
              <Text style={styles.sectionH}>
                {sec.no}. {sec.label}
              </Text>
              {sec.rows && sec.rows.length > 0 ? (
                <HandlingTable rows={sec.rows} />
              ) : (
                <SectionBody body={sec.body} />
              )}
            </View>
          ))}
          <Text style={[styles.apology, { marginTop: 10 }]}>{m.closing}</Text>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
