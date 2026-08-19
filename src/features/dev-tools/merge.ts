/**
 * 카탈로그(파일에서 읽은 것)와 토글(사람이 내린 결정)을 합친다.
 *
 * **파일이 진실이다.** 스킬 폴더가 사라지면 토글 기록이 남아 있어도 목록에 안
 * 나온다 — 없는 것을 끄고 켜게 두면 화면이 실제와 갈라진다.
 */

import type { ToolEntry, ToolKind } from "./scan";

export type Toggle = {
  kind: ToolKind;
  name: string;
  enabled: boolean;
  updatedAt: string;
};

export type ToolRow = ToolEntry & { enabled: boolean };

const key = (kind: string, name: string) => `${kind}/${name}`;

export function mergeToggles(
  catalog: readonly ToolEntry[],
  toggles: readonly Toggle[],
): ToolRow[] {
  const byKey = new Map(toggles.map((t) => [key(t.kind, t.name), t]));
  return catalog.map((e) => {
    // 못 끄는 종류는 기록이 있어도 켜진 것으로 둔다. 화면에 '꺼짐'이라고 적어놓고
    // 실제로는 돌고 있으면 그게 가장 나쁘다.
    if (!e.toggleable) return { ...e, enabled: true };
    const t = byKey.get(key(e.kind, e.name));
    // 기록이 없으면 켜져 있다 — 파일이 있으면 곧 활성이다.
    return { ...e, enabled: t ? t.enabled : true };
  });
}

/**
 * 아직 로컬에 반영 안 된 변경 건수.
 *
 * 웹에서 끈다고 바로 꺼지지 않는다(`npm run tools:apply` 가 반영한다). 이 숫자를
 * 화면에 띄우지 않으면 껐다고 믿은 채로 계속 돌게 된다.
 */
export function unappliedCount(
  toggles: readonly Toggle[],
  appliedAt: string | null,
): number {
  if (!appliedAt) return toggles.length;
  const at = Date.parse(appliedAt);
  return toggles.filter((t) => Date.parse(t.updatedAt) > at).length;
}

export function groupCounts(
  entries: readonly ToolEntry[],
): Record<ToolKind, number> {
  const out: Record<ToolKind, number> = { skill: 0, agent: 0, hook: 0, rule: 0 };
  for (const e of entries) out[e.kind] += 1;
  return out;
}
