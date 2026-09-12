/**
 * TIP 후보 리포 메타의 표기 규칙 — **표와 인스펙터가 이 한 곳을 같이 쓴다.**
 *
 * 판정을 Table·View 양쪽에 적어 두면 한쪽만 고쳐진 채로 같은 후보가 표에서는
 * '없음', 인스펙터에서는 '—' 로 보인다. 둘이 뜻하는 바가 정반대라 그대로
 * 오해가 된다.
 */

/** `known=false` 는 '못 받았다' — 호출부가 흐린 색으로 둔다. */
export type RepoMetaCell = { text: string; known: boolean };

/**
 * 주 언어 칸 — 세 갈래다.
 *
 * | 언어 | 조회시각 | 표기 | 뜻 |
 * |---|---|---|---|
 * | 있음 | 무관 | 그 값 | 값 자체가 물어봤다는 증거다 |
 * | 없음 | 있음 | `없음` | 물어봤는데 주 언어가 없다 — 문서·설정 전용 리포 |
 * | 없음 | 없음 | `—` | 안 물어봤다 |
 *
 * **둘째와 셋째를 한 칸으로 합치지 않는다.** 앞은 고칠 게 없는 정상이고 뒤는
 * 백필이 필요한 빈칸인데, 화면이 구분을 못 하면 멀쩡한 리포를 계속 다시
 * 조회하게 된다. 이 레포의 어휘로 `—` 는 '못 받았다', 값은 '진짜 그렇다'다.
 */
export function repoLanguageCell(
  language: string | null | undefined,
  syncedAt: string | null | undefined,
): RepoMetaCell {
  if (language) return { text: language, known: true };
  if (syncedAt) return { text: "없음", known: true };
  return { text: "—", known: false };
}
