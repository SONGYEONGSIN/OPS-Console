import { describe, expect, it } from "vitest";
import {
  dutyForWeek,
  recipientWarning,
  writerRoster,
  type RecipientOperator,
  type WriterCandidate,
} from "../roster";

const w = (
  email: string,
  team: string,
  role: string,
  status: string,
  name = "운영자A",
): WriterCandidate => ({ email, name, team, role, status });

const op = (over: Partial<RecipientOperator> = {}): RecipientOperator => ({
  email: "r@x",
  status: "active",
  permission: "member",
  allowed_menus: [],
  ...over,
});

describe("writerRoster", () => {
  it("작성 포함 목록에 든 부장·팀장은 작성 대상이 된다(운영1·2팀·활성일 때만)", () => {
    const rows = [
      w("lead@x", "운영2팀", "팀장", "active"),
      w("boss@x", "운영1팀", "부장", "active"),
      w("gone@x", "운영1팀", "팀장", "inactive"),
      w("a@x", "운영1팀", "매니저", "active"),
    ];
    expect(
      writerRoster(rows, [], ["lead@x", "gone@x"]).map((r) => r.email),
    ).toEqual(["lead@x", "a@x"]);
  });

  it("제외 목록이 포함보다 앞선다", () => {
    const rows = [w("lead@x", "운영2팀", "팀장", "active")];
    expect(writerRoster(rows, ["lead@x"], ["lead@x"])).toEqual([]);
  });

  it("작성 대상 = 운영1·2팀 · 활성 · 부장/팀장 제외 · 제외 목록 제외", () => {
    const rows = [
      w("a@x", "운영1팀", "매니저", "active"),
      w("b@x", "운영1팀", "부장", "active"),
      w("c@x", "운영2팀", "팀장", "active"),
      w("d@x", "운영2팀", "TL", "active"),
      w("e@x", "기획팀", "매니저", "active"),
      w("f@x", "운영2팀", "매니저", "inactive"),
      w("t@x", "운영2팀", "매니저", "active"),
    ];
    expect(writerRoster(rows, ["t@x"]).map((r) => r.email)).toEqual([
      "a@x",
      "d@x",
    ]);
  });

  it("입력 순서를 지키고 name 을 trim 한다", () => {
    const rows = [
      w("b@x", "운영1팀", "매니저", "active", "  운영자B "),
      w("a@x", "운영2팀", "매니저", "active", "운영자A"),
    ];
    const out = writerRoster(rows, []);
    expect(out.map((r) => r.email)).toEqual(["b@x", "a@x"]);
    expect(out[0].name).toBe("운영자B");
    expect(rows[0].name).toBe("  운영자B "); // 입력은 바뀌지 않는다
  });
});

describe("dutyForWeek", () => {
  const rot = ["a@x", "b@x", "c@x"];
  it("anchor 주 = 첫 사람, 그 뒤로 돌고, anchor 이전도 돈다", () => {
    expect(dutyForWeek("2026-11-16", rot, "2026-11-16")).toBe("a@x");
    expect(dutyForWeek("2026-11-30", rot, "2026-11-16")).toBe("c@x");
    expect(dutyForWeek("2026-12-07", rot, "2026-11-16")).toBe("a@x");
    expect(dutyForWeek("2026-11-09", rot, "2026-11-16")).toBe("c@x");
    expect(dutyForWeek("2026-11-16", [], "2026-11-16")).toBeNull();
    expect(dutyForWeek("2026-11-16", rot, null)).toBeNull();
  });
});

describe("recipientWarning", () => {
  it("없음·비활성", () => {
    expect(recipientWarning(null)).toBe("not-operator");
    expect(recipientWarning(op({ status: "inactive" }))).toBe("inactive");
    expect(
      recipientWarning(op({ status: "suspended", permission: "admin" })),
    ).toBe("inactive"); // 비활성이 먼저다
  });

  it("지금 정책에선 allowed_menus 가 비어도 경고하지 않는다(경고 과다 방지)", () => {
    expect(
      recipientWarning(op({ permission: "member", allowed_menus: [] })),
    ).toBeNull();
    expect(
      recipientWarning(
        op({ permission: "viewer", allowed_menus: ["receivables"] }),
      ),
    ).toBeNull();
    expect(
      recipientWarning(op({ permission: null, allowed_menus: [] })),
    ).toBeNull();
  });
});
