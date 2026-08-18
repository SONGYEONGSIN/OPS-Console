import { PROPOSAL_FOLDER } from "./frontmatter";

/**
 * 볼트에서 지울 수 있는 문서인지 판정한다. **`제안/`에만 연다.**
 *
 * 열람 화면은 설계상 읽기 전용이다 — 원본이 파일이라 웹에서 지우면 OneDrive 동기를
 * 타고 사라지고 되돌릴 방법이 화면에 없다. 사람이 쓴 지식은 계속 옵시디언에서 지운다.
 *
 * 다만 **에이전트 초안은 화면에서 치울 길이 없어 쌓이기만 했다.** 초안은 다시 만들면
 * 되므로 여기만 여는 것이 위험 대비 값이 맞다.
 *
 * 순수 함수로 둔 이유: 라우트 안에 묻으면 탈출 시도를 테스트할 수 없다.
 */
export function assertDeletableProposal(path: string): void {
  if (!path.trim()) {
    throw new Error("경로가 비었습니다");
  }
  // 상위 참조는 정규화 전에 막는다 — `제안/../엔티티/x.md`가 통과하면 안 된다.
  if (path.includes("..")) {
    throw new Error(`경로에 상위 참조가 있습니다: ${path}`);
  }
  // 접두 위장(`제안-x/`)을 막으려면 구분자까지 붙여 비교해야 한다.
  if (!path.startsWith(`${PROPOSAL_FOLDER}/`)) {
    throw new Error(`제안 폴더의 문서만 지울 수 있습니다: ${path}`);
  }
  if (!path.endsWith(".md")) {
    throw new Error(`.md 문서만 지울 수 있습니다: ${path}`);
  }
}
