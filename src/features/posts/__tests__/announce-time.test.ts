import { describe, it, expect } from "vitest";
import { kstLocalToIso, isoToKstLocal } from "../announce-time";

/**
 * 화면의 datetime-local 은 시간대가 없는 'YYYY-MM-DDTHH:mm' 을 준다.
 * 브라우저에 맡기면 다른 시간대에서 연 창이 다른 시각으로 저장된다 — 서버가 KST 로 읽는다.
 */
describe("공지 시각 — 화면 값 → 저장", () => {
  it("KST 로 읽는다", () => {
    // 09:00 KST = 00:00 UTC
    expect(kstLocalToIso("2026-09-07T09:00")).toBe("2026-09-07T00:00:00.000Z");
  });

  it("자정을 넘겨도 날짜가 밀린다", () => {
    // 08:00 KST = 전날 23:00 UTC
    expect(kstLocalToIso("2026-09-07T08:00")).toBe("2026-09-06T23:00:00.000Z");
  });

  it("비우면 null — 즉시 공유를 뜻한다", () => {
    expect(kstLocalToIso("")).toBeNull();
    expect(kstLocalToIso(null)).toBeNull();
  });

  it("형식이 아니면 null — 반쯤 적힌 값을 저장하지 않는다", () => {
    expect(kstLocalToIso("2026-09-07")).toBeNull();
  });
});

describe("공지 시각 — 저장 → 화면 값", () => {
  it("KST 로 되돌린다", () => {
    expect(isoToKstLocal("2026-09-07T00:00:00.000Z")).toBe("2026-09-07T09:00");
  });

  it("왕복해도 같다 — 열었다 그냥 저장했을 때 시각이 밀리면 안 된다", () => {
    for (const local of [
      "2026-09-07T09:00",
      "2026-01-01T00:00",
      "2026-12-31T23:59",
    ]) {
      expect(isoToKstLocal(kstLocalToIso(local))).toBe(local);
    }
  });

  it("없으면 빈 문자열 — 입력창이 비어 있어야 한다", () => {
    expect(isoToKstLocal(null)).toBe("");
  });

  it("옛 날짜 값(YYYY-MM-DD)도 읽는다 — 마이그레이션 전 화면이 깨지지 않게", () => {
    // 마이그레이션은 그날 00:00 KST 로 옮긴다. 같은 값이 나와야 한다.
    expect(isoToKstLocal("2026-09-07")).toBe("2026-09-07T00:00");
  });
});
