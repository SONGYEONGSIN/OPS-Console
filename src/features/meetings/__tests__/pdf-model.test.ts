import { describe, it, expect } from "vitest";
import { blocksToPdfModel } from "../pdf-model";

describe("blocksToPdfModel", () => {
  it("heading → kind heading + level + 런", () => {
    const m = blocksToPdfModel([
      { id: "1", type: "heading", props: { level: 2 }, content: [{ type: "text", text: "목적", styles: {} }], children: [] },
    ]);
    expect(m).toEqual([{ kind: "heading", level: 2, runs: [{ text: "목적", bold: false, italic: false }] }]);
  });
  it("heading level 4~6은 3으로 클램프", () => {
    const m = blocksToPdfModel([
      { id: "h", type: "heading", props: { level: 5 }, content: [{ type: "text", text: "x", styles: {} }], children: [] },
    ]);
    expect(m[0]).toMatchObject({ kind: "heading", level: 3 });
  });
  it("paragraph 인라인 bold/italic 보존", () => {
    const m = blocksToPdfModel([
      {
        id: "2",
        type: "paragraph",
        props: {},
        content: [
          { type: "text", text: "중요 ", styles: { bold: true } },
          { type: "text", text: "기울임", styles: { italic: true } },
        ],
        children: [],
      },
    ]);
    expect(m[0]).toEqual({
      kind: "paragraph",
      runs: [
        { text: "중요 ", bold: true, italic: false },
        { text: "기울임", bold: false, italic: true },
      ],
    });
  });
  it("link inline → 중첩 content에서 런 추출", () => {
    const m = blocksToPdfModel([
      {
        id: "l",
        type: "paragraph",
        props: {},
        content: [{ type: "link", href: "http://x", content: [{ type: "text", text: "링크텍스트", styles: { bold: true } }] }],
        children: [],
      },
    ]);
    expect(m[0]).toEqual({ kind: "paragraph", runs: [{ text: "링크텍스트", bold: true, italic: false }] });
  });
  it("bullet / numbered / check", () => {
    const m = blocksToPdfModel([
      { id: "3", type: "bulletListItem", props: {}, content: [{ type: "text", text: "불릿", styles: {} }], children: [] },
      { id: "4", type: "numberedListItem", props: {}, content: [{ type: "text", text: "번호", styles: {} }], children: [] },
      { id: "5", type: "checkListItem", props: { checked: true }, content: [{ type: "text", text: "완료", styles: {} }], children: [] },
    ]);
    expect(m[0].kind).toBe("bullet");
    expect(m[1].kind).toBe("numbered");
    expect(m[2]).toMatchObject({ kind: "check", checked: true });
  });
  it("미지원 블록은 paragraph 폴백", () => {
    const m = blocksToPdfModel([
      { id: "6", type: "weirdEmbed", props: {}, content: [{ type: "text", text: "폴백", styles: {} }], children: [] },
    ]);
    expect(m).toEqual([{ kind: "paragraph", runs: [{ text: "폴백", bold: false, italic: false }] }]);
  });
  it("빈 content는 빈 런", () => {
    const m = blocksToPdfModel([{ id: "7", type: "paragraph", props: {}, content: [], children: [] }]);
    expect(m[0]).toEqual({ kind: "paragraph", runs: [] });
  });
  it("children 평탄화", () => {
    const m = blocksToPdfModel([
      {
        id: "8",
        type: "bulletListItem",
        props: {},
        content: [{ type: "text", text: "부모", styles: {} }],
        children: [
          { id: "9", type: "bulletListItem", props: {}, content: [{ type: "text", text: "자식", styles: {} }], children: [] },
        ],
      },
    ]);
    expect(m.map((n) => n.kind)).toEqual(["bullet", "bullet"]);
    const second = m[1];
    if (second.kind === "table") throw new Error("expected non-table node");
    expect(second.runs[0].text).toBe("자식");
  });
});
