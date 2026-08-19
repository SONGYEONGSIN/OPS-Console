import { describe, it, expect } from "vitest";
import { TOOL_CATALOG } from "../catalog.generated";

/**
 * 커밋된 생성물이 멀쩡한지 본다. 생성기가 깨진 채로 커밋되면 화면이 통째로 비는데,
 * CI 의 드리프트 확인은 `.claude/` 와 어긋난 것만 잡지 '비었지만 일치'는 통과시킨다.
 */
describe("도구 카탈로그", () => {
  it("네 종류가 모두 들어 있다", () => {
    for (const kind of ["skill", "agent", "hook", "rule"] as const) {
      expect(TOOL_CATALOG.filter((e) => e.kind === kind).length).toBeGreaterThan(
        0,
      );
    }
  });

  it("이름과 경로가 비어 있지 않다 — 목록에서 못 고르거나 어디인지 모르게 된다", () => {
    for (const e of TOOL_CATALOG) {
      expect(e.name, JSON.stringify(e)).not.toBe("");
      expect(e.path).toContain(".claude/");
    }
  });

  it("끌 수 있는 건 스킬뿐이다 — 다른 종류에 스위치를 놓으면 화면이 거짓말한다", () => {
    for (const e of TOOL_CATALOG) {
      expect(e.toggleable).toBe(e.kind === "skill");
    }
  });

  it("같은 종류 안에 이름이 겹치지 않는다 — 토글이 엉뚱한 것을 끈다", () => {
    const keys = TOOL_CATALOG.map((e) => `${e.kind}/${e.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("스킬은 호출 명령어를 가진다", () => {
    for (const e of TOOL_CATALOG.filter((x) => x.kind === "skill")) {
      expect(e.invoke).toBe(`Skill("${e.name}")`);
    }
  });
});
