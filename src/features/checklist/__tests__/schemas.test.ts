import { describe, it, expect } from "vitest";
import { DEPARTMENTS, itemPatchSchema, createRoundSchema } from "../schemas";

describe("checklist schemas", () => {
  it("부서는 5개 고정", () => {
    expect(DEPARTMENTS).toEqual([
      "기획파트",
      "운영부",
      "고객지원팀",
      "개발부",
      "영업부",
    ]);
  });
  it("itemPatch: 유효 상태 통과", () => {
    expect(
      itemPatchSchema.safeParse({ status: "done", note: "완료" }).success,
    ).toBe(true);
  });
  it("itemPatch: 잘못된 상태 거부", () => {
    expect(itemPatchSchema.safeParse({ status: "완료" }).success).toBe(false);
  });
  it("createRound: title 필수", () => {
    expect(
      createRoundSchema.safeParse({ title: "", seed: "empty" }).success,
    ).toBe(false);
    expect(
      createRoundSchema.safeParse({ title: "2027 수시", seed: "template" })
        .success,
    ).toBe(true);
  });
});
