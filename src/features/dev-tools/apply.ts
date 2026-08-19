/**
 * 웹에서 내린 결정을 `.claude/settings.local.json` 의 deny 목록으로 옮긴다.
 *
 * **그 파일은 우리 것이 아니다.** permissions·env·hooks 가 함께 들어 있고, 한 번
 * 잘못 쓰면 Claude Code 가 안 뜬다 — 그때는 이걸 고칠 도구까지 같이 망가진다.
 * 그래서 손대는 범위를 여기서 못박는다: **카탈로그에 있는 스킬의 `Skill(…)` 항목만.**
 * 사람이 손으로 넣은 차단이나 다른 종류의 규칙은 그대로 둔다.
 */

const RULE = /^Skill\((.+)\)$/;

export function nextDenyList(
  deny: readonly string[],
  /** 레포 카탈로그에 있는 스킬 이름. 이 밖의 `Skill(…)` 은 남의 것이라 안 건드린다. */
  catalogNames: readonly string[],
  disabled: readonly string[],
): string[] {
  const managed = new Set(catalogNames);

  const kept = deny.filter((rule) => {
    const m = RULE.exec(rule);
    if (!m) return true; // 스킬 규칙이 아니면 남의 것
    return !managed.has(m[1]); // 카탈로그 밖 스킬 차단도 남의 것
  });

  // 정렬해 넣는다. 끈 순서에 따라 파일이 달라지면 diff 가 매번 나 무엇이 바뀐
  // 건지 알 수 없다.
  const added = [...new Set(disabled)]
    .filter((n) => managed.has(n))
    .sort()
    .map((n) => `Skill(${n})`);

  return [...kept, ...added];
}
