import { describe, it, expect } from "vitest";
import { ccForRecipient } from "../cc";

const CC = [
  { name: "박시현", email: "pkm0313@jinhakapply.com" },
  { name: "김승현", email: "ksh@jinhakapply.com" },
];

describe("ccForRecipient — 받는사람과 중복되는 CC 제외", () => {
  it("받는사람이 CC에 없으면 CC 그대로", () => {
    expect(ccForRecipient(CC, "song@jinhakapply.com")).toEqual(CC);
  });

  it("받는사람이 CC에 있으면 그 항목만 제외", () => {
    expect(ccForRecipient(CC, "pkm0313@jinhakapply.com")).toEqual([
      { name: "김승현", email: "ksh@jinhakapply.com" },
    ]);
  });

  it("대소문자 무시 + 공백 트림", () => {
    expect(ccForRecipient(CC, " PKM0313@JinhakApply.com ")).toEqual([
      { name: "김승현", email: "ksh@jinhakapply.com" },
    ]);
  });

  it("CC 빈 배열이면 빈 배열", () => {
    expect(ccForRecipient([], "x@y.com")).toEqual([]);
  });
});
