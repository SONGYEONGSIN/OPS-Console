import type { DevControlSpecItem } from "./schemas";

/**
 * 재생성 결과(next)에 기존(prev)의 `included` 를 key 매칭으로 이식한다.
 *
 * **운영자가 뺀 항목이 되살아나면 사고다** — 학교로 나간 메일은 되돌릴 수 없다.
 * 문구는 새것을 쓰고 결정만 이어받는다. `mergeFlags` 와 같은 문제라 같은 모양이다.
 *
 * 새로 생긴 항목은 포함이 기본이다 — 안내에서 빠뜨리는 쪽이 더 나쁘다.
 */
export function mergeSpecItems(
  prev: DevControlSpecItem[],
  next: DevControlSpecItem[],
): DevControlSpecItem[] {
  const prevByKey = new Map(prev.map((p) => [p.key, p]));
  return next.map((n) => {
    const old = prevByKey.get(n.key);
    return old ? { ...n, included: old.included } : n;
  });
}
