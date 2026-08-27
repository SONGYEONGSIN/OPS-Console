import { PROPOSAL_FOLDER } from "./frontmatter";
import { CATEGORY_ORDER } from "./shared";

/**
 * 검토를 마친 초안을 본 위치로 옮길 자리를 판정한다.
 *
 * **`제안/` 에서 나가는 방향만 연다.** 본 위치 문서를 옮기는 건 여러 사람이 함께
 * 쓰는 파일이라, 버튼 한 번으로 남의 문서가 소리 없이 움직이면 안 된다. 폴러의
 * `promote-lib.mjs` 와 같은 규칙이다 — 채팅으로 옮기든 화면으로 옮기든 같은 문을
 * 지나야 한다.
 *
 * 순수 함수로 둔 이유: 액션 안에 묻으면 탈출 시도를 테스트할 수 없다.
 */
export function resolvePromotionPath(
  path: string,
  category: string,
): { fileName: string; toPath: string } {
  const rel = path.trim();
  if (!rel) throw new Error("경로가 비었습니다");
  // 상위 참조는 정규화 전에 막는다 — `제안/../규칙/x.md` 가 통과하면 안 된다.
  if (rel.includes("..")) {
    throw new Error(`경로에 상위 참조가 있습니다: ${rel}`);
  }
  // 접두 위장(`제안-x/`)을 막으려면 구분자까지 붙여 비교해야 한다.
  if (!rel.startsWith(`${PROPOSAL_FOLDER}/`)) {
    throw new Error(`제안 폴더의 문서만 옮길 수 있습니다: ${rel}`);
  }
  if (!rel.endsWith(".md")) {
    throw new Error(`.md 문서만 옮길 수 있습니다: ${rel}`);
  }
  // 볼트에 없는 폴더가 생기면 안 된다. `제안` 자신도 여기 없어 되돌리기가 막힌다.
  if (!CATEGORY_ORDER.includes(category as (typeof CATEGORY_ORDER)[number])) {
    throw new Error(`알 수 없는 분류입니다: ${category}`);
  }

  const fileName = rel.slice(PROPOSAL_FOLDER.length + 1);
  return { fileName, toPath: `${category}/${fileName}` };
}
