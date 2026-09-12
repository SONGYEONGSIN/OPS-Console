// 백필 순수 로직 — GitHub/Supabase를 부르지 않는다.
// 호출부(backfill-repo-meta.mjs)와 분리해 단위 테스트가 가능하게 둔다.

/**
 * GET /repos/{owner}/{repo} 응답 → update payload.
 *
 * stars를 같이 갱신하는 이유: repo_synced_at 하나가 세 값의 시점을 책임지므로,
 * 별을 안 건드리면 한 행 안에 옛 별과 새 언어가 섞여 "이 값들은 N월 N일 기준"이
 * 거짓이 된다.
 *
 * 리포 객체가 아니면(404·삭제·비공개) null — 호출부는 그 행을 손대지 않는다.
 * repo_synced_at을 적는 순간 '물어봤는데 언어가 없는 리포'로 둔갑하기 때문이다.
 */
export function toRepoMetaUpdate(json, now) {
  if (!json || typeof json !== "object" || !json.full_name) return null;
  return {
    // 키를 빼지 않고 null로 남긴다 — 없는 키와 null은 화면에서 뜻이 다르다.
    repo_language: json.language ?? null,
    repo_pushed_at: json.pushed_at ?? null,
    stars: json.stargazers_count ?? 0,
    repo_synced_at: now.toISOString(),
  };
}
