import { describe, it, expect } from "vitest";
import { canEditBilling, mergeBilling, isSettled } from "../completion";

/**
 * 정산완료·발행은 **돈이 얽힌 기록**이라 아무나 닫지 못한다.
 *
 * 판정 규칙은 오픈안내(`open-notices/actions.ts`)와 같다 — 본인 담당이거나 admin.
 * 다른 규칙을 새로 만들면 같은 질문에 두 답이 생긴다.
 */
describe("canEditBilling", () => {
  it("본인이 담당한 서비스면 된다", () => {
    expect(
      canEditBilling({
        operatorName: "송영신",
        myName: "송영신",
        permission: "member",
      }),
    ).toBe(true);
  });

  it("admin 은 남의 담당도 된다", () => {
    expect(
      canEditBilling({
        operatorName: "김유민",
        myName: "송영신",
        permission: "admin",
      }),
    ).toBe(true);
  });

  it("남의 담당은 안 된다", () => {
    expect(
      canEditBilling({
        operatorName: "김유민",
        myName: "송영신",
        permission: "member",
      }),
    ).toBe(false);
  });

  it("viewer 는 본인 담당이어도 안 된다 — 읽기 전용 권한이다", () => {
    expect(
      canEditBilling({
        operatorName: "송영신",
        myName: "송영신",
        permission: "viewer",
      }),
    ).toBe(false);
  });

  it("viewer 는 admin 이 아닌 한 못 쓴다 — 권한 조합이 뒤집히지 않는다", () => {
    expect(
      canEditBilling({
        operatorName: "김유민",
        myName: "송영신",
        permission: "viewer",
      }),
    ).toBe(false);
  });

  it("담당자가 없는 서비스는 admin 만 다룬다 — 아무나 열면 주인 없는 건이 조용히 닫힌다", () => {
    expect(
      canEditBilling({
        operatorName: null,
        myName: "송영신",
        permission: "member",
      }),
    ).toBe(false);
    expect(
      canEditBilling({
        operatorName: null,
        myName: "송영신",
        permission: "admin",
      }),
    ).toBe(true);
  });

  it("권한을 모르면 안 된다 — operators 조회가 실패하면 permission 이 null 로 온다", () => {
    expect(
      canEditBilling({
        operatorName: "송영신",
        myName: "송영신",
        permission: null,
      }),
    ).toBe(false);
  });

  it("내 이름을 모르면 안 된다 — operators 에 등록되지 않은 계정", () => {
    expect(
      canEditBilling({
        operatorName: "송영신",
        myName: null,
        permission: "member",
      }),
    ).toBe(false);
  });
});

describe("isSettled", () => {
  it("정산완료 시각이 있으면 완료", () => {
    expect(isSettled({ settledAt: "2026-08-24T01:00:00Z", issuedAt: null })).toBe(
      true,
    );
  });

  it("없으면 미완료", () => {
    expect(isSettled({ settledAt: null, issuedAt: null })).toBe(false);
    expect(isSettled(undefined)).toBe(false);
  });
});

describe("mergeBilling", () => {
  const svc = (service_id: number) => ({ service_id, name: `svc-${service_id}` });

  it("서비스ID 로 정산·발행 상태를 붙인다", () => {
    const [r] = mergeBilling([svc(100)], {
      100: { settledAt: "2026-08-24T01:00:00Z", issuedAt: null },
    });
    expect(r.settledAt).toBe("2026-08-24T01:00:00Z");
    expect(r.issuedAt).toBeNull();
    expect(r.name).toBe("svc-100"); // 원래 필드는 그대로
  });

  it("기록이 없는 서비스는 둘 다 null — 그게 '아직 안 했다'는 뜻이다", () => {
    const [r] = mergeBilling([svc(999)], {});
    expect(r.settledAt).toBeNull();
    expect(r.issuedAt).toBeNull();
  });

  it("서비스ID 0 도 붙는다 — `!id` 로 거르면 0 이 falsy 라 통째로 샌다", () => {
    const [r] = mergeBilling([svc(0)], {
      0: { settledAt: "2026-08-24T01:00:00Z", issuedAt: null },
    });
    expect(r.settledAt).toBe("2026-08-24T01:00:00Z");
  });

  it("원본 배열을 바꾸지 않는다", () => {
    const rows = [svc(1)];
    mergeBilling(rows, { 1: { settledAt: "x", issuedAt: null } });
    expect(rows[0]).not.toHaveProperty("settledAt");
  });
});
