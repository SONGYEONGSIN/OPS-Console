import { describe, it, expect } from "vitest";
import { authorizeToolRequest } from "../tool-auth";

/**
 * 도구 요청자 검증 — `search_ops`와 `fetch_ops`가 같은 검사를 쓴다.
 *
 * 7개 테이블의 RLS가 `for select to authenticated using (true)`라 행은 안 걸러진다
 * (2026-08-18 확인). 그래서 권한은 사람 단위로 여기서 건다. 두 라우트가 각자
 * 복사하면 한쪽만 고쳐지므로 한 곳에 두고 여기서 검증한다.
 */

describe("authorizeToolRequest", () => {
  it("없는 운영자는 403", () => {
    const r = authorizeToolRequest(null);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.status).toBe(403);
  });

  it("비활성 운영자는 403 — 탈퇴자가 계속 묻지 못하게", () => {
    const r = authorizeToolRequest({ permission: "member", status: "deleted" });
    expect(r.ok).toBe(false);
  });

  it("viewer는 403 — 어시스턴트 자체 정책과 같은 선", () => {
    const r = authorizeToolRequest({ permission: "viewer", status: "active" });
    expect(r.ok).toBe(false);
  });

  it("권한이 null이면 403", () => {
    const r = authorizeToolRequest({ permission: null, status: "active" });
    expect(r.ok).toBe(false);
  });

  it("member는 통과하고 볼 수 있는 도메인을 받는다", () => {
    const r = authorizeToolRequest({ permission: "member", status: "active" });
    expect(r.ok).toBe(true);
    expect(r.ok === true && r.allowed.has("handover")).toBe(true);
  });

  it("admin은 7개 도메인을 전부 받는다", () => {
    const r = authorizeToolRequest({ permission: "admin", status: "active" });
    expect(r.ok === true && r.allowed.size).toBe(7);
  });
});
