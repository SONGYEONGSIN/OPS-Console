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

function Section({
  no,
  label,
  body,
}: {
  no: number;
  label: string;
  body: string | null;
}) {
  return (
    <View wrap={false}>
      <Text style={styles.sectionH}>
        {no}. {label}
      </Text>
      <Text style={styles.sectionBody}>{body ?? ""}</Text>
    </View>
  );
}

export async function renderIncidentReportPdf(
  input: IncidentReportPdfInput,
): Promise<Buffer> {
  ensureFontRegistered();
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand} fixed>
          대한민국 대표 원서접수 사이트 진학어플라이 · 대한민국 최대 입시전문
          포탈사이트 진학닷컴
        </Text>
        <Text style={styles.row}>수신자  {input.recipientUniversity}</Text>
        <Text style={styles.row}>제  목  {input.title}</Text>
        <Text style={styles.apology}>{input.apology}</Text>
        <Text style={styles.row}>
          붙임 : 1. {input.title} 경위서 1부.  끝.
        </Text>
        <View style={styles.approvalTable}>
          <Text style={styles.approvalCell}>
            담당자{"\n"}
            {input.authorName}
          </Text>
          <Text style={styles.approvalCell}>
            팀장{"\n"}
            {input.approverName ?? ""}
          </Text>
          <Text style={styles.approvalCell}>
            본부장{"\n"}
            {input.directorName ?? ""}
          </Text>
          <Text style={styles.approvalCellLast}>
            사장{"\n"}
            {input.ceoName ?? ""}
          </Text>
        </View>
        {input.docNumber ? (
          <Text style={styles.docNumber}>시행  {input.docNumber}</Text>
        ) : null}
        <Text style={styles.footer} fixed>
          운영부 상황실 · 자동 발송 문서
        </Text>
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.reportTitle}>경 위 서</Text>
        <Text style={styles.row}>
          작 성 일 자 : {input.draftDate}      작 성 자 : {input.authorName}
        </Text>
        <Text style={[styles.row, styles.bold]}>제    목 : {input.title}</Text>
        <Section no={1} label="경위" body={input.gyeongwi} />
        <Section no={2} label="원인" body={input.cause} />
        <Section no={3} label="처리" body={input.handling} />
        <Section no={4} label="향후 대책" body={input.prevention} />
        <Text style={styles.apology}>
          이번 오류로 업무에 불편을 드린 점 거듭 사과드립니다. 향후 이러한
          문제가 다시 발생하지 않도록 하겠습니다.
        </Text>
        <Text style={styles.footer} fixed>
          운영부 상황실 · 자동 발송 문서
        </Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
