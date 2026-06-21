import { describe, it, expect } from "vitest";
import { isMeetingDoc, STAMP_LABELS, STAMP_STATUSES } from "../form-model";

describe("form-model", () => {
  it("상태 배지 4종(talk/done/follow/hold) 라벨", () => {
    expect(STAMP_STATUSES).toEqual(["talk", "done", "follow", "hold"]);
    expect(STAMP_LABELS).toEqual({
      talk: "진행중",
      done: "완료",
      follow: "후속필요",
      hold: "보류",
    });
  });

  it("isMeetingDoc — v2 객체만 인식(기존 블록 배열·null 거부)", () => {
    expect(isMeetingDoc({ formVersion: 2, typeId: "regular" })).toBe(true);
    expect(isMeetingDoc([{ type: "heading" }])).toBe(false);
    expect(isMeetingDoc(null)).toBe(false);
    expect(isMeetingDoc({ formVersion: 1 })).toBe(false);
  });
});
