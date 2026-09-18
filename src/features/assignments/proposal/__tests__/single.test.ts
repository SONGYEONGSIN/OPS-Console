import { describe, it, expect } from "vitest";
import { assignSingle } from "../single";

/**
 * 단건 배정 — 관리자가 서비스 하나를 지목했을 때(§6.3).
 *
 * **후보가 좁아 에이전트 없이 끝나는 경우가 많다.** 같은 대학·같은 업무종류를 이미
 * 맡은 사람이 있으면 그 사람이다 — 대학 담당자와의 관계가 자산이라(§6.1 λ) 새
 * 서비스를 남에게 주는 것이 오히려 비용이다.
 *
 * **후보가 없으면 미배정으로 두고 보고한다 — 추측해 채우지 않는다.** 아무나
 * 넣으면 그 사람은 자기 것이 된 줄 모르고, 아무도 안 본 서비스가 오픈한다.
 */
const op = (email: string, assignable = true) => ({
  email,
  name: email,
  tenure_group: "2",
  assignable,
  hired_at: "2020-01-02",
});

const cell = (
  university_name: string,
  assignee_email: string | null,
  work_kind = "원서접수",
  subtype = "수시",
  role = "운영",
) => ({ university_name, work_kind, subtype, role, assignee_email });

const ctx = (o: Partial<Parameters<typeof assignSingle>[1]> = {}) => ({
  operators: [op("a@x.com"), op("b@x.com")],
  ledger: [cell("가대", "a@x.com"), cell("나대", "b@x.com")],
  ...o,
});

const target = { university_name: "가대", work_kind: "원서접수" };

describe("assignSingle", () => {
  it("그 대학의 그 업무를 이미 맡은 사람에게 준다", () => {
    const r = assignSingle(target, ctx());

    expect(r).toMatchObject({ kind: "assign", assignee_email: "a@x.com" });
  });

  it("근거에 왜 그 사람인지가 남는다 — 사람이 승인할 문장이다", () => {
    const r = assignSingle(target, ctx());

    expect(r.kind === "assign" && r.reason).toMatch(/가대.*원서접수.*담당/);
  });

  it("아무도 안 맡았으면 판정이 필요하다", () => {
    const r = assignSingle(
      { university_name: "다대", work_kind: "원서접수" },
      ctx(),
    );

    expect(r).toEqual({ kind: "ask" });
  });

  it("업무종류가 다르면 그 대학 담당자라도 자동으로 주지 않는다", () => {
    // 원서접수 담당과 PIMS 담당은 원래 다를 수 있다(§6.1).
    const r = assignSingle(
      { university_name: "가대", work_kind: "PIMS" },
      ctx(),
    );

    expect(r).toEqual({ kind: "ask" });
  });

  it("지금 담당자가 배정 대상이 아니면 판정이 필요하다", () => {
    // 팀장이 된 사람에게 새 서비스를 자동으로 더 얹지 않는다(§3.4).
    // b 는 배정 대상으로 남겨 둔다 — 후보가 0명이면 그건 미배정 쪽 이야기다.
    const r = assignSingle(
      target,
      ctx({ operators: [op("a@x.com", false), op("b@x.com")] }),
    );

    expect(r).toEqual({ kind: "ask" });
  });

  it("지금 담당자가 명부에 없으면 판정이 필요하다", () => {
    const r = assignSingle(target, ctx({ operators: [op("b@x.com")] }));

    expect(r).toEqual({ kind: "ask" });
  });

  it("그 칸이 갈려 있으면 판정이 필요하다 — 둘 중 누구인지 우리가 못 정한다", () => {
    const r = assignSingle(
      target,
      ctx({
        ledger: [
          cell("가대", "a@x.com", "원서접수", "수시"),
          cell("가대", "b@x.com", "원서접수", "정시"),
        ],
      }),
    );

    expect(r).toEqual({ kind: "ask" });
  });

  it("개발 칸은 보지 않는다 — 배정은 운영 칸이다", () => {
    const r = assignSingle(
      target,
      ctx({ ledger: [cell("가대", null, "원서접수", "수시", "개발")] }),
    );

    expect(r).toEqual({ kind: "ask" });
  });

  it("배정 대상이 한 명도 없으면 미배정이다 — 추측해 채우지 않는다", () => {
    const r = assignSingle(
      target,
      ctx({ operators: [op("a@x.com", false)], ledger: [] }),
    );

    expect(r).toMatchObject({ kind: "unassigned" });
    expect(r.kind === "unassigned" && r.reason).toMatch(/배정 대상/);
  });

  it("상담앱은 제안하지 않는다 — 자동 배정 대상이 아니다", () => {
    // 사용자 결정 6(rev 2). 화면에는 보이되 제안을 만들지 않는다.
    const r = assignSingle(
      { university_name: "가대", work_kind: "상담앱" },
      ctx({ ledger: [cell("가대", "a@x.com", "상담앱")] }),
    );

    expect(r).toMatchObject({ kind: "unassigned" });
    expect(r.kind === "unassigned" && r.reason).toMatch(/상담앱/);
  });
});
