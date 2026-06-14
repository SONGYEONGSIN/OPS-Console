import { describe, it, expect } from "vitest";
import {
  NOW_CHARACTERS,
  pickNowCharacterIndex,
  daySeedFromYmd,
} from "../now-characters";

describe("NOW_CHARACTERS", () => {
  it("캐릭터 4종 이상 + id 고유", () => {
    expect(NOW_CHARACTERS.length).toBeGreaterThanOrEqual(4);
    const ids = NOW_CHARACTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("각 캐릭터는 id와 렌더 노드를 가진다", () => {
    for (const c of NOW_CHARACTERS) {
      expect(c.id.length).toBeGreaterThan(0);
      expect(c.node).toBeTruthy();
    }
  });
});

describe("daySeedFromYmd", () => {
  it("YYYY-MM-DD → 정수 시드", () => {
    expect(daySeedFromYmd("2026-06-14")).toBe(20260614);
    expect(daySeedFromYmd("2026-06-15")).toBe(20260615);
  });
});

describe("pickNowCharacterIndex", () => {
  it("seed % count — 같은 시드/카운트면 항상 같은 인덱스(데일리 안정)", () => {
    expect(pickNowCharacterIndex(20260614, 5)).toBe(20260614 % 5);
    expect(pickNowCharacterIndex(20260614, 5)).toBe(
      pickNowCharacterIndex(20260614, 5),
    );
  });

  it("날짜가 바뀌면 결정적으로 회전", () => {
    const a = pickNowCharacterIndex(daySeedFromYmd("2026-06-14"), 5);
    const b = pickNowCharacterIndex(daySeedFromYmd("2026-06-15"), 5);
    expect(a).toBe(20260614 % 5);
    expect(b).toBe(20260615 % 5);
  });

  it("count<=0이면 0 반환(안전)", () => {
    expect(pickNowCharacterIndex(5, 0)).toBe(0);
  });
});
