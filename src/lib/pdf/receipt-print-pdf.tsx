import "server-only";
import {
  Document,
  Page,
  View,
  Image,
  Text,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";
import {
  PAGE_MM,
  fitToSlot,
  toPages,
} from "@/features/postal/receipt-print/layout";

/**
 * 우편 영수증 출력 — 내부 전표에 붙일 A4.
 *
 * 한 페이지 = 한 줄 3칸. **머리글이 없다** — 영수증 자리를 줄이지 않는다. 쪽번호만.
 * 안내 문구도 찍지 않는다 — 전표에 붙는 종이다(형광펜이 빠진 장수는 화면이 알린다).
 */

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

/** mm → pt(react-pdf 기본 단위) */
const pt = (mm: number) => (mm * 72) / 25.4;

export type PrintSlot =
  | { kind: "image"; jpeg: Buffer; widthPx: number; heightPx: number }
  | { kind: "error"; label: string; reason: string };

const styles = StyleSheet.create({
  page: { padding: pt(PAGE_MM.margin), fontFamily: "Pretendard" },
  row: { flexDirection: "row", alignItems: "flex-start" },
  slot: { width: pt(PAGE_MM.slotWidth) },
  gap: { marginLeft: pt(PAGE_MM.gap) },
  missing: { borderWidth: 0.5, borderColor: "#6b6253", padding: pt(4) },
  missingLabel: { fontSize: 9, fontWeight: 700, color: "#15120c" },
  missingReason: { marginTop: 4, fontSize: 8, color: "#6b6253" },
  footer: {
    position: "absolute",
    bottom: pt(4),
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
    color: "#6b6253",
  },
});

function Slot({ slot }: { slot: PrintSlot }) {
  if (slot.kind === "error") {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingLabel}>{slot.label}</Text>
        <Text style={styles.missingReason}>{slot.reason}</Text>
      </View>
    );
  }
  const { widthMm, heightMm } = fitToSlot(slot.widthPx, slot.heightPx);
  // 파일 경로가 아니라 Buffer 로 넘긴다 — 경로 문자열로는 임베드되지 않는다(incident-report-pdf 와 같다).
  return (
    // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image는 alt 미지원
    <Image
      src={{ data: slot.jpeg, format: "jpg" }}
      style={{ width: pt(widthMm), height: pt(heightMm) }}
    />
  );
}

export async function renderReceiptPrintPdf(
  slots: PrintSlot[],
): Promise<Buffer> {
  ensureFontRegistered();
  const pages = toPages(slots);
  const doc = (
    <Document title="우편 영수증">
      {pages.map((page, p) => (
        <Page key={p} size="A4" style={styles.page}>
          <View style={styles.row} wrap={false}>
            {page.map((slot, i) => (
              <View
                key={i}
                style={i === 0 ? styles.slot : [styles.slot, styles.gap]}
              >
                <Slot slot={slot} />
              </View>
            ))}
          </View>
          <Text style={styles.footer}>{`${p + 1} / ${pages.length}`}</Text>
        </Page>
      ))}
    </Document>
  );
  return renderToBuffer(doc);
}
