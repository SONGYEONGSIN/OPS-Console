import { describe, it, expect } from "vitest";
import { isOwnerOrActiveDelegate } from "../delegation";

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
