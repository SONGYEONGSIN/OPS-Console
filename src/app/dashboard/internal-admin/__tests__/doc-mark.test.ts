import { describe, it, expect } from "vitest";
import {
  DOC_KINDS,
  type DocKind,
  type DocStatus,
} from "@/features/sms-sender/types";
import { docTally, markLabel } from "../_components/doc-mark";

const docsOf = (over: Partial<Record<DocKind, string>> = {}): DocStatus => ({
  sejongStatus: "",
  marks: {
    ...(Object.fromEntries(DOC_KINDS.map((k) => [k, "O"])) as Record<
      DocKind,
      string
    >),
    ...over,
  },
  submitState: "",
  completeness: "완비",
  missing: "",
});

describe("docTally", () => {
  it("전부 O 면 8/8, 미제출·표시 없음 0", () => {
    expect(docTally(docsOf())).toEqual({
      submitted: 8,
      total: 8,
      missing: [],
      unknown: 0,
    });
  });

  it("'대체' 는 제출로 센다", () => {
    expect(docTally(docsOf({ 법인인감: "대체" })).submitted).toBe(8);
  });

  it("✕ 는 미제출 — 시트 열 순서(DOC_KINDS) 그대로", () => {
    const t = docTally(docsOf({ 신분증: "✕", 위임장: "✕" }));
    expect(t.submitted).toBe(6);
    expect(t.missing).toEqual(["위임장", "신분증"]);
    expect(t.unknown).toBe(0);
  });

  it("빈 칸·모르는 표시는 제출도 미제출도 아니다", () => {
    const t = docTally(docsOf({ 위임장: "", 신분증: "X", 재직증명서: "×" }));
    expect(t.submitted).toBe(5);
    expect(t.missing).toEqual([]);
    expect(t.unknown).toBe(3);
  });
});

describe("markLabel", () => {
  it("O → 제출 (ink)", () => {
    expect(markLabel("O")).toMatchObject({ text: "제출", aria: "제출" });
    expect(markLabel("O").className).toContain("text-ink");
  });

  it("✕ → 미제출 칩 (vermilion 테두리)", () => {
    const l = markLabel("✕");
    expect(l.text).toBe("미제출");
    for (const c of [
      "border",
      "border-vermilion",
      "px-1.5",
      "text-xs",
      "text-vermilion",
    ]) {
      expect(l.className.split(/\s+/)).toContain(c);
    }
  });

  it("대체 → 대체 인정 (muted)", () => {
    expect(markLabel("대체").text).toBe("대체 인정");
    expect(markLabel("대체").className).toContain("text-muted");
  });

  it("빈 칸 → '-' , 읽을 때는 '표시 없음'", () => {
    expect(markLabel("")).toMatchObject({ text: "-", aria: "표시 없음" });
    expect(markLabel("").className).toContain("text-muted");
  });

  it("모르는 표시는 대체·제출로 바꾸지 않고 원문을 보인다", () => {
    for (const m of ["X", "×", "제출?"]) {
      const l = markLabel(m);
      expect(l.text).toBe(`알 수 없음(${m})`);
      expect(l.className).toContain("text-muted");
    }
  });
});
