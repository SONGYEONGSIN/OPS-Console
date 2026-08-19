import { describe, it, expect } from "vitest";
import { mergeToggles, unappliedCount, groupCounts } from "../merge";
import type { ToolEntry } from "../scan";

const skill = (name: string): ToolEntry => ({
  kind: "skill",
  name,
  description: "",
  path: `.claude/skills/${name}/SKILL.md`,
  invoke: `Skill("${name}")`,
  meta: {},
  toggleable: true,
});
const rule: ToolEntry = {
  kind: "rule",
  name: "tdd",
  description: "",
  path: ".claude/rules/tdd.md",
  invoke: null,
  meta: {},
  toggleable: false,
};

describe("카탈로그와 토글 합치기", () => {
  it("아무 기록이 없으면 켜져 있다 — 파일이 있으면 곧 활성이다", () => {
    const r = mergeToggles([skill("a")], []);
    expect(r[0].enabled).toBe(true);
  });

  it("끈 기록이 있으면 꺼진 것으로 본다", () => {
    const r = mergeToggles(
      [skill("a")],
      [{ kind: "skill", name: "a", enabled: false, updatedAt: "2026-08-20T00:00:00Z" }],
    );
    expect(r[0].enabled).toBe(false);
  });

  it("사라진 스킬의 기록은 무시한다 — 파일이 진실이다", () => {
    const r = mergeToggles(
      [skill("a")],
      [{ kind: "skill", name: "없어진것", enabled: false, updatedAt: "2026-08-20T00:00:00Z" }],
    );
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("a");
  });

  it("종류가 다르면 남남이다 — 스킬 a 와 룰 a 는 다른 것이다", () => {
    const r = mergeToggles(
      [skill("a")],
      [{ kind: "rule", name: "a", enabled: false, updatedAt: "2026-08-20T00:00:00Z" }],
    );
    expect(r[0].enabled).toBe(true);
  });

  it("못 끄는 종류는 기록이 있어도 켜진 것으로 둔다 — 화면이 거짓말하면 안 된다", () => {
    const r = mergeToggles(
      [rule],
      [{ kind: "rule", name: "tdd", enabled: false, updatedAt: "2026-08-20T00:00:00Z" }],
    );
    expect(r[0].enabled).toBe(true);
  });
});

describe("아직 반영 안 된 변경", () => {
  const t = (name: string, at: string) => ({
    kind: "skill" as const,
    name,
    enabled: false,
    updatedAt: at,
  });

  it("적용 뒤에 바뀐 것만 센다", () => {
    const n = unappliedCount(
      [t("a", "2026-08-20T01:00:00Z"), t("b", "2026-08-20T03:00:00Z")],
      "2026-08-20T02:00:00Z",
    );
    expect(n).toBe(1);
  });

  it("한 번도 적용한 적 없으면 전부 미반영이다", () => {
    expect(unappliedCount([t("a", "2026-08-20T01:00:00Z")], null)).toBe(1);
  });

  it("적용과 같은 시각이면 반영된 것으로 본다", () => {
    expect(unappliedCount([t("a", "2026-08-20T02:00:00Z")], "2026-08-20T02:00:00Z")).toBe(0);
  });
});

describe("종류별 개수", () => {
  it("탭에 쓸 숫자를 센다", () => {
    expect(groupCounts([skill("a"), skill("b"), rule])).toEqual({
      skill: 2,
      agent: 0,
      hook: 0,
      rule: 1,
    });
  });
});
