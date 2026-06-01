/**
 * GAS `similarity_` + `isNameMatchStrong_` 1:1 포팅.
 * 입력 길이 가드 100자 (Levenshtein O(n*m) 폭주 방지 — GAS와 동일 안전장치).
 */

import { normalizeName } from "./normalize";

const MAX_LEN = 100;

/** Levenshtein distance 기반 유사도 0~1. 빈 문자열 한쪽이라도 → 0. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const sa = a.toLowerCase().slice(0, MAX_LEN);
  const sb = b.toLowerCase().slice(0, MAX_LEN);
  const alen = sa.length;
  const blen = sb.length;

  const dp: number[][] = Array.from({ length: alen + 1 }, () =>
    Array(blen + 1).fill(0),
  );

  for (let i = 0; i <= alen; i++) dp[i][0] = i;
  for (let j = 0; j <= blen; j++) dp[0][j] = j;

  for (let i = 1; i <= alen; i++) {
    for (let j = 1; j <= blen; j++) {
      const cost = sa[i - 1] === sb[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  const distance = dp[alen][blen];
  return 1 - distance / Math.max(alen, blen);
}

/**
 * 강매칭 — 완전 일치 또는 양방향 부분포함 (최소 3자 이상).
 * GAS `isNameMatchStrong_`: 정규화 → 완전일치 → 길이 ≥ 3 시 양방향 includes.
 */
export function isNameMatchStrong(
  cust: string,
  content: string,
  extraAliases: Record<string, string> = {},
): boolean {
  if (!cust || !content) return false;
  const a = normalizeName(cust, extraAliases);
  const b = normalizeName(content, extraAliases);

  if (a === "" || b === "") return false;
  if (a === b) return true;
  if (a.length >= 3 && b.includes(a)) return true;
  if (b.length >= 3 && a.includes(b)) return true;

  return false;
}
