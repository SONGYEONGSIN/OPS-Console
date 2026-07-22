import { describe, it, expect } from "vitest";
import { computeCompletion } from "../completion";

const item = (status) => ({
  id: "x",
  roundId: "r",
  department: "개발부",
  category: "",
  title: "t",
  status,
  note: "",
  sortOrder: 0,
});

describe("computeCompletion", () => {
  it("na는 분모에서 제외", () => {
    const r = computeCompletion([item("done"), item("todo"), item("na")]);
    expect(r).toMatchObject({ total: 3, done: 1, na: 1 });
    expect(r.pct).toBe(50); // done 1 / (3-1 na) = 50%
  });
  it("전부 na면 pct 0", () => {
    expect(computeCompletion([item("na")]).pct).toBe(0);
  });
  it("빈 목록은 pct 0", () => {
    expect(computeCompletion([]).pct).toBe(0);
  });
  it("null 상태는 todo가 아니라 미지정으로 분모 포함, 완료 아님", () => {
    const r = computeCompletion([item("done"), item(null)]);
    expect(r.pct).toBe(50);
  });
});
