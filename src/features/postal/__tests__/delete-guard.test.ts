import { describe, it, expect } from "vitest";
import { canDeleteReceipt } from "../delete-guard";

const me = { permission: "member" as const, displayName: "송영신" };
const 남의것 = { uploadedBy: "이해영", confirmedAt: null };
const 내것 = { uploadedBy: "송영신", confirmedAt: null };

describe("영수증 삭제 판정", () => {
  it("내가 올린 확정 전 영수증은 지울 수 있다", () => {
    expect(canDeleteReceipt(me, 내것)).toEqual({ ok: true });
  });

  it("확정된 영수증은 못 지운다 — 전도금 엑셀에 이미 한 줄 들어갔다", () => {
    const r = canDeleteReceipt(me, {
      uploadedBy: "송영신",
      confirmedAt: "2026-08-19T11:00:00Z",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/확정/);
  });

  it("남이 올린 건 못 지운다", () => {
    const r = canDeleteReceipt(me, 남의것);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/올린 사람/);
  });

  it("admin은 남이 올린 것도 지울 수 있다", () => {
    expect(
      canDeleteReceipt({ permission: "admin", displayName: "관리자" }, 남의것),
    ).toEqual({ ok: true });
  });

  it("admin이어도 확정건은 못 지운다 — 장부 근거가 사라진다", () => {
    const r = canDeleteReceipt(
      { permission: "admin", displayName: "관리자" },
      { uploadedBy: "이해영", confirmedAt: "2026-08-19T11:00:00Z" },
    );
    expect(r.ok).toBe(false);
  });

  it("viewer는 못 지운다", () => {
    const r = canDeleteReceipt(
      { permission: "viewer", displayName: "송영신" },
      내것,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/읽기 전용/);
  });

  it("판독 중이어도 지울 수 있다 — 폴러가 멈추면 영영 못 지우게 된다", () => {
    // 실제로 화면에 '영수증을 읽는 중'으로 멈춰 있던 행이 이 경우다.
    expect(canDeleteReceipt(me, 내것)).toEqual({ ok: true });
  });
});
