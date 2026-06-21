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
import {
  isMeetingDoc,
  type MeetingDoc,
  type Section,
} from "@/features/meetings/form-model";

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
  table: { marginVertical: 4, borderTop: "1px solid #d8d2c4", borderLeft: "1px solid #d8d2c4" },
  tr: { flexDirection: "row" },
  td: { flex: 1, borderRight: "1px solid #d8d2c4", borderBottom: "1px solid #d8d2c4", padding: 3, fontSize: 9 },
  th: { flex: 1, borderRight: "1px solid #d8d2c4", borderBottom: "1px solid #d8d2c4", padding: 3, fontSize: 9, fontWeight: 700, backgroundColor: "#f4eddd" },
  // v2 양식 스타일
  dispatch: { fontSize: 9, fontWeight: 700, color: "#15120c", marginBottom: 4, letterSpacing: 0.5 },
  v2title: { fontSize: 24, fontWeight: 700, color: "#15120c", marginBottom: 10, borderBottom: "1.5px solid #15120c", paddingBottom: 8 },
  tbWrap: { flexDirection: "row", flexWrap: "wrap", border: "1px solid #15120c", marginBottom: 6 },
  tbCell: { width: "25%", borderRight: "1px solid #d8cfbb", borderBottom: "1px solid #d8cfbb", padding: "5px 8px" },
  tbCellFull: { width: "100%", borderBottom: "1px solid #d8cfbb", padding: "5px 8px" },
  tbK: { fontSize: 8, fontWeight: 700, color: "#716855" },
  tbV: { fontSize: 10, color: "#15120c", marginTop: 1 },
  seclabel: { flexDirection: "row", alignItems: "center", marginTop: 14, marginBottom: 6 },
  secNo: { fontSize: 9, fontWeight: 700, color: "#faf4e6", backgroundColor: "#15120c", padding: "2px 6px", marginRight: 6 },
  secTitle: { fontSize: 13, fontWeight: 700, color: "#15120c" },
  kvRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  kvBox: { width: "48%", border: "1px solid #d8cfbb", marginBottom: 6 },
  kvK: { fontSize: 8, fontWeight: 700, color: "#faf4e6", backgroundColor: "#3d3529", padding: "4px 8px" },
  kvV: { fontSize: 10, padding: "6px 8px", minHeight: 28 },
  station: { fontSize: 11, fontWeight: 700, color: "#faf4e6", backgroundColor: "#15120c", padding: "4px 10px", marginTop: 6, marginBottom: 4, alignSelf: "flex-start" },
  qaRow: { marginBottom: 4, paddingLeft: 8 },
  qaWho: { fontSize: 8, fontWeight: 700, color: "#3d3529" },
  qaBody: { fontSize: 10, marginBottom: 2 },
  banner: { flexDirection: "row", alignItems: "center", border: "1.5px solid #b8331e", backgroundColor: "#fdeceb", padding: "8px 12px", marginVertical: 4 },
  bannerSev: { fontSize: 9, fontWeight: 700, color: "#faf4e6", backgroundColor: "#b8331e", padding: "3px 8px", marginRight: 8 },
  bannerTxt: { fontSize: 11, fontWeight: 700, color: "#b8331e", flex: 1 },
  note: { flexDirection: "row", marginBottom: 2 },
  signs: { flexDirection: "row", justifyContent: "flex-end", marginTop: 20 },
  sg: { width: 70, border: "1px solid #15120c", marginLeft: -1 },
  sgH: { fontSize: 8, fontWeight: 700, textAlign: "center", padding: 3, borderBottom: "1px solid #d8cfbb", backgroundColor: "#f4eddd" },
  sgS: { height: 40 },
});

const STAMP_KO: Record<string, string> = { talk: "진행중", done: "완료", follow: "후속필요", hold: "보류" };
const SEC_LETTERS = "ABCDEFGHIJ".split("");

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
  if (node.kind === "table")
    return (
      <View style={s.table}>
        {node.rows.map((row, ri) => (
          <View style={s.tr} key={ri}>
            {row.map((cell, ci) => (
              <View style={ri < node.headerRows ? s.th : s.td} key={ci}>
                <Runs runs={cell} />
              </View>
            ))}
          </View>
        ))}
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

function V2SectionBody({ sec }: { sec: Section }) {
  if (sec.kind === "table") {
    const dataCols = sec.headers.length;
    return (
      <View style={s.table}>
        <View style={s.tr}>
          {sec.headers.map((h, i) => (
            <Text style={s.th} key={i}>
              {h}
            </Text>
          ))}
        </View>
        {sec.rows.map((r, ri) => {
          let ci = 0;
          return (
            <View style={s.tr} key={ri}>
              {Array.from({ length: dataCols }).map((_, i) => {
                if (sec.idx && i === 0)
                  return (
                    <Text style={s.td} key={i}>
                      {String(ri + 1).padStart(2, "0")}
                    </Text>
                  );
                if (sec.status && i === dataCols - 1)
                  return (
                    <Text style={s.td} key={i}>
                      {STAMP_KO[r.status ?? "talk"]}
                    </Text>
                  );
                const v = r.cells[ci] ?? "";
                ci += 1;
                return (
                  <Text style={s.td} key={i}>
                    {v}
                  </Text>
                );
              })}
            </View>
          );
        })}
      </View>
    );
  }
  if (sec.kind === "ledger")
    return (
      <View>
        {sec.stations.map((st, si) => (
          <View key={si}>
            <Text style={s.station}>
              {String(si + 1).padStart(2, "0")} {st.title}
            </Text>
            {st.threads.map((th, ti) => (
              <View key={ti} style={s.qaRow}>
                <Text style={s.qaWho}>대학 · 질문 [{STAMP_KO[th.status]}]</Text>
                <Text style={s.qaBody}>{th.q}</Text>
                <Text style={s.qaWho}>진학 · 답변</Text>
                <Text style={s.qaBody}>{th.a}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  if (sec.kind === "kv")
    return (
      <View style={s.kvRow}>
        {sec.boxes.map((b, i) => (
          <View key={i} style={s.kvBox}>
            <Text style={s.kvK}>{b.key}</Text>
            <Text style={s.kvV}>{b.value}</Text>
          </View>
        ))}
      </View>
    );
  if (sec.kind === "notes" || sec.kind === "list")
    return (
      <View>
        {sec.items.map((t, i) => (
          <View key={i} style={s.note}>
            <Text style={s.liMark}>•</Text>
            <Text>{t}</Text>
          </View>
        ))}
      </View>
    );
  // banner
  return (
    <View style={s.banner}>
      <Text style={s.bannerSev}>{sec.sev || "Sev-2"}</Text>
      <Text style={s.bannerTxt}>{sec.text}</Text>
      <Text style={s.qaWho}>[{STAMP_KO[sec.status]}]</Text>
    </View>
  );
}

function renderMeetingFormPdf(meeting: MeetingRow, doc: MeetingDoc) {
  ensureFontRegistered();
  const dateStr = meeting.meeting_date
    ? new Date(meeting.meeting_date).toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
      })
    : "—";
  let letter = 0;
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.dispatch}>
          [운영부 상황실] · {MEETING_TYPE_LABELS[meeting.type]} 회의록
        </Text>
        <Text style={s.v2title}>{meeting.title || "제목 없음"}</Text>
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

        {doc.titleBlock.length > 0 && (
          <View style={s.tbWrap}>
            {doc.titleBlock.map((tb, i) => (
              <View key={i} style={tb.span === 4 ? s.tbCellFull : s.tbCell}>
                <Text style={s.tbK}>{tb.key}</Text>
                <Text style={s.tbV}>{tb.value || " "}</Text>
              </View>
            ))}
          </View>
        )}

        {doc.sections.map((sec, i) => {
          if (sec.kind === "banner")
            return <V2SectionBody key={i} sec={sec} />;
          const l = SEC_LETTERS[letter] ?? "";
          letter += 1;
          return (
            <View key={i} wrap={false}>
              <View style={s.seclabel}>
                <Text style={s.secNo}>{l}</Text>
                <Text style={s.secTitle}>{sec.title}</Text>
              </View>
              <V2SectionBody sec={sec} />
            </View>
          );
        })}

        {doc.approval && (
          <View style={s.signs}>
            {["작성", "검토", "승인"].map((h) => (
              <View key={h} style={s.sg}>
                <Text style={s.sgH}>{h}</Text>
                <View style={s.sgS} />
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

export function renderMeetingPdf(meeting: MeetingRow) {
  if (isMeetingDoc(meeting.content))
    return renderMeetingFormPdf(meeting, meeting.content);
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
