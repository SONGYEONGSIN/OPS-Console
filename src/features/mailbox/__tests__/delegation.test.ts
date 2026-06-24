import { describe, it, expect } from "vitest";
import { isOwnerOrActiveDelegate, expiryFromDate } from "../delegation";

describe("expiryFromDate — 종료일(YYYY-MM-DD) → KST 그날 끝 ISO", () => {
  it("날짜를 KST 23:59:59.999 만료로 변환한다", () => {
    // 2026-07-24 23:59:59.999 +09:00 == 2026-07-24T14:59:59.999Z
    expect(expiryFromDate("2026-07-24")).toBe("2026-07-24T14:59:59.999Z");
  });
  it("null/빈 값(무기한)은 null", () => {
    expect(expiryFromDate(null)).toBeNull();
    expect(expiryFromDate("")).toBeNull();
  });
});

describe("isOwnerOrActiveDelegate", () => {
  const active = [{ owner_email: "a@x.com", grantee_email: "b@x.com" }];
  it("본인(viewer===owner) → true", () => {
    expect(isOwnerOrActiveDelegate("a@x.com", "a@x.com", [])).toBe(true);
  });
  it("활성 위임(owner=a, grantee=b) → b가 a 접근 true", () => {
    expect(isOwnerOrActiveDelegate("b@x.com", "a@x.com", active)).toBe(true);
  });
  it("위임 없는 타인 → false", () => {
    expect(isOwnerOrActiveDelegate("c@x.com", "a@x.com", active)).toBe(false);
  });
  it("방향 반대(b 메일함을 a가) → false", () => {
    expect(isOwnerOrActiveDelegate("a@x.com", "b@x.com", active)).toBe(false);
  });
});
