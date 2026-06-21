export type PdfRun = { text: string; bold: boolean; italic: boolean };
export type PdfNode =
  | { kind: "heading"; level: 1 | 2 | 3; runs: PdfRun[] }
  | { kind: "paragraph"; runs: PdfRun[] }
  | { kind: "bullet"; runs: PdfRun[] }
  | { kind: "numbered"; runs: PdfRun[] }
  | { kind: "check"; checked: boolean; runs: PdfRun[] }
  | { kind: "table"; headerRows: number; rows: PdfRun[][][] };

type StyledText = { type: "text"; text?: string; styles?: { bold?: boolean; italic?: boolean } };
type LinkInline = { type: "link"; href?: string; content?: unknown };
type Block = {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: Block[];
};

function pushRuns(content: unknown, acc: PdfRun[]): void {
  if (!Array.isArray(content)) return;
  for (const c of content) {
    if (!c || typeof c !== "object") continue;
    const t = (c as { type?: string }).type;
    if (t === "text") {
      const st = c as StyledText;
      acc.push({ text: st.text ?? "", bold: st.styles?.bold === true, italic: st.styles?.italic === true });
    } else if (t === "link") {
      pushRuns((c as LinkInline).content, acc); // 중첩 StyledText 추출
    }
  }
}

function toRuns(content: unknown): PdfRun[] {
  const a: PdfRun[] = [];
  pushRuns(content, a);
  return a;
}

/** 표 셀 → runs. 셀은 string(시드) / inline content array / tableCell 객체(에디터 저장) 모두 처리. */
function cellRuns(cell: unknown): PdfRun[] {
  if (typeof cell === "string") {
    return cell ? [{ text: cell, bold: false, italic: false }] : [];
  }
  if (Array.isArray(cell)) return toRuns(cell);
  // BlockNote 정규화 형태: { type:"tableCell", content:[...] }
  if (cell && typeof cell === "object" && "content" in cell) {
    return toRuns((cell as { content: unknown }).content);
  }
  return [];
}

export function blocksToPdfModel(blocks: Block[]): PdfNode[] {
  const out: PdfNode[] = [];
  for (const b of blocks ?? []) {
    const runs = toRuns(b.content);
    switch (b.type) {
      case "heading": {
        const raw = Number(b.props?.level);
        const level = (raw >= 1 && raw <= 3 ? raw : raw > 3 ? 3 : 2) as 1 | 2 | 3;
        out.push({ kind: "heading", level, runs });
        break;
      }
      case "bulletListItem":
        out.push({ kind: "bullet", runs });
        break;
      case "numberedListItem":
        out.push({ kind: "numbered", runs });
        break;
      case "checkListItem":
        out.push({ kind: "check", checked: b.props?.checked === true, runs });
        break;
      case "paragraph":
        out.push({ kind: "paragraph", runs });
        break;
      case "table": {
        // b.content = { type:"tableContent", headerRows?, rows:[{cells:[...]}] }
        // cell은 string(시드) 또는 inline content array(편집 후) 둘 다 처리.
        const tc = b.content as
          | { headerRows?: number; rows?: { cells?: unknown[] }[] }
          | undefined;
        const rows = (tc?.rows ?? []).map((r) =>
          (r.cells ?? []).map((cell) => cellRuns(cell)),
        );
        out.push({ kind: "table", headerRows: tc?.headerRows ?? 0, rows });
        break;
      }
      default:
        out.push({ kind: "paragraph", runs });
    }
    if (Array.isArray(b.children) && b.children.length > 0) out.push(...blocksToPdfModel(b.children));
  }
  return out;
}
