import type { DevControlFlag } from "./schemas";

/** 재분석 결과(next)에 기존(prev)의 checked/note를 key 매칭으로 이식. */
export function mergeFlags(
  prev: DevControlFlag[],
  next: DevControlFlag[],
): DevControlFlag[] {
  const prevByKey = new Map(prev.map((p) => [p.key, p]));
  return next.map((n) => {
    const old = prevByKey.get(n.key);
    return old ? { ...n, checked: old.checked, note: old.note } : n;
  });
}
