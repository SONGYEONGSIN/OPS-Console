export type PdfRun = { text: string; bold: boolean; italic: boolean };
export type PdfNode =
  | { kind: "heading"; level: 1 | 2 | 3; runs: PdfRun[] }
  | { kind: "paragraph"; runs: PdfRun[] }
  | { kind: "bullet"; runs: PdfRun[] }
  | { kind: "numbered"; runs: PdfRun[] }
  | { kind: "check"; checked: boolean; runs: PdfRun[] };

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
      default:
        out.push({ kind: "paragraph", runs });
    }
    if (Array.isArray(b.children) && b.children.length > 0) out.push(...blocksToPdfModel(b.children));
  }
  return out;
}
