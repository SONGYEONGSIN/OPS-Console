import { describe, it, expect } from "vitest";
import { nextDenyList } from "../apply";

const catalog = ["brainstorm", "commit", "verify"];

describe("settings.local.json 의 deny 목록 다시 쓰기", () => {
  it("끈 스킬을 막는다", () => {
    expect(nextDenyList([], catalog, ["commit"])).toEqual(["Skill(commit)"]);
  });

  it("다시 켜면 뺀다", () => {
    expect(nextDenyList(["Skill(commit)"], catalog, [])).toEqual([]);
  });

  it("스킬과 무관한 규칙은 손대지 않는다 — 이 파일은 우리 것이 아니다", () => {
    const deny = ["WebFetch(*)", "Write(/etc/**)"];
    expect(nextDenyList(deny, catalog, ["commit"])).toEqual([
      ...deny,
      "Skill(commit)",
    ]);
  });

  it("카탈로그에 없는 Skill 차단은 남긴다 — 사람이 손으로 넣었을 수 있다", () => {
    const r = nextDenyList(["Skill(내가막은것)"], catalog, ["commit"]);
    expect(r).toContain("Skill(내가막은것)");
    expect(r).toContain("Skill(commit)");
  });

  it("두 번 돌려도 같다 — 매번 diff 가 나면 무엇이 바뀐 건지 알 수 없다", () => {
    const once = nextDenyList(["WebFetch(*)"], catalog, ["commit", "verify"]);
    expect(nextDenyList(once, catalog, ["commit", "verify"])).toEqual(once);
  });

  it("이미 막힌 것을 또 넣지 않는다", () => {
    const r = nextDenyList(["Skill(commit)"], catalog, ["commit"]);
    expect(r.filter((x) => x === "Skill(commit)")).toHaveLength(1);
  });

  it("순서가 일정하다 — 끈 순서가 달라도 파일은 같아야 한다", () => {
    expect(nextDenyList([], catalog, ["verify", "commit"])).toEqual(
      nextDenyList([], catalog, ["commit", "verify"]),
    );
  });
});
