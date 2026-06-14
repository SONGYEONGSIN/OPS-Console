import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import path from "node:path";
import {
  blocksToPdfModel,
  type PdfNode,
  type PdfRun,
} from "@/features/meetings/pdf-model";
import { numberedSequence } from "@/features/meetings/pdf-numbering";
import {
  MEETING_TYPE_LABELS,
  type MeetingRow,
} from "@/features/meetings/schemas";

// 폰트 등록 — incident-report-pdf.tsx와 동일 family명/경로/등록 방식 (Pretendard Regular + Bold)
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

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Pretendard", fontSize: 10, color: "#15120c" },
  brand: { fontSize: 9, color: "#b8331e", fontWeight: 700, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  metaRow: { flexDirection: "row", marginBottom: 2, fontSize: 9, color: "#3d3529" },
  metaKey: { width: 60, color: "#716855" },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 4, color: "#b8331e" },
  para: { marginBottom: 3, lineHeight: 1.5 },
  li: { flexDirection: "row", marginBottom: 2, lineHeight: 1.5 },
  liMark: { width: 14 },
});

function Runs({ runs }: { runs: PdfRun[] }) {
  if (runs.length === 0) return <Text> </Text>;
  return (
    <Text>
      {runs.map((r, i) => (
        <Text
          key={i}
          style={{
            fontWeight: r.bold ? 700 : 400,
            fontStyle: r.italic ? "italic" : "normal",
          }}
        >
          {r.text}
        </Text>
      ))}
    </Text>
  );
}

function Node({ node, idx }: { node: PdfNode; idx: number }) {
  if (node.kind === "heading")
    return (
      <Text style={s.h2}>
        <Runs runs={node.runs} />
      </Text>
    );
  if (node.kind === "paragraph")
    return (
      <View style={s.para}>
        <Runs runs={node.runs} />
      </View>
    );
  const mark =
    node.kind === "bullet"
      ? "•"
      : node.kind === "numbered"
        ? `${idx}.`
        : node.checked
          ? "[v]"
          : "[ ]";
  return (
    <View style={s.li}>
      <Text style={s.liMark}>{mark}</Text>
      <Runs runs={node.runs} />
    </View>
  );
}

export function renderMeetingPdf(meeting: MeetingRow) {
  ensureFontRegistered();
  const model = blocksToPdfModel(
    meeting.content as Parameters<typeof blocksToPdfModel>[0],
  );
  const seq = numberedSequence(model);
  const dateStr = meeting.meeting_date
    ? new Date(meeting.meeting_date).toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
      })
    : "—";
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>[운영부 상황실]</Text>
        <Text style={s.title}>{meeting.title}</Text>
        <View style={s.metaRow}>
          <Text style={s.metaKey}>유형</Text>
          <Text>{MEETING_TYPE_LABELS[meeting.type]}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaKey}>일시</Text>
          <Text>{dateStr}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaKey}>장소</Text>
          <Text>{meeting.location ?? "—"}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaKey}>참석자</Text>
          <Text>{meeting.attendees.join(", ") || "—"}</Text>
        </View>
        <View style={{ marginTop: 10 }}>
          {model.map((n, i) => (
            <Node key={i} node={n} idx={seq[i]} />
          ))}
        </View>
      </Page>
    </Document>
  );
}
