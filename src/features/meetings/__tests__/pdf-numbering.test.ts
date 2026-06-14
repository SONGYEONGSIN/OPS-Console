import { describe, it, expect } from "vitest";
import { numberedSequence } from "../pdf-numbering";
import type { PdfNode } from "../pdf-model";

function num(): PdfNode {
  return { kind: "numbered", runs: [] };
}
function bullet(): PdfNode {
  return { kind: "bullet", runs: [] };
}
function para(): PdfNode {
  return { kind: "paragraph", runs: [] };
}

describe("numberedSequence", () => {
  it("연속 numbered 구간은 1부터 1씩 증가", () => {
    expect(numberedSequence([num(), num(), num()])).toEqual([1, 2, 3]);
  });

  it("다른 kind를 만나면 카운터 리셋", () => {
    const model = [num(), num(), para(), num(), num()];
    // numbered가 아닌 노드의 idx는 의미 없음(0). numbered만 1부터 재시작 확인.
    expect(numberedSequence(model)).toEqual([1, 2, 0, 1, 2]);
  });

  it("bullet로 끊긴 두 구간도 각각 1부터", () => {
    const model = [num(), bullet(), num()];
    expect(numberedSequence(model)).toEqual([1, 0, 1]);
  });
});
