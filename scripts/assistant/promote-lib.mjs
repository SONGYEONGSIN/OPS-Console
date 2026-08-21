import { resolve, sep } from "node:path";
import { PROPOSAL_DIR, VAULT_CATEGORIES } from "./propose-lib.mjs";

export { PROPOSAL_DIR, VAULT_CATEGORIES };

/**
 * 검토를 마친 초안을 본 위치로 옮긴다.
 *
 * `제안/` 은 "사람이 읽은 것만 본 위치에 들어간다"는 관문이다. 채팅에서 내용을
 * 그대로 보여주고 사람이 "맞다"고 하면 그게 검토다 — 옵시디언을 여는 것과 판단의
 * 질이 다르지 않고, 보고 나서 바로 결정하므로 오히려 낫다(2026-08-21).
 *
 * **`제안/` 에서 나가는 방향만 연다.** 본 위치 문서를 옮기거나 지우는 건 여러 사람이
 * 함께 쓰는 파일이라, 채팅 한 마디로 남의 문서가 소리 없이 바뀌면 안 된다.
 *
 * 순수 함수로 둔 이유: 폴러 안에 묻으면 탈출 시도를 테스트할 수 없다.
 */
export function resolvePromotion(vaultRoot, proposalRel, category) {
  const rel = String(proposalRel ?? "").trim();
  if (!rel) throw new Error("옮길 문서 경로가 비었습니다");
  // 상위 참조는 정규화 전에 막는다 — `제안/../엔티티/x.md` 가 통과하면 안 된다.
  if (rel.includes("..")) {
    throw new Error(`경로에 상위 참조가 있습니다: ${rel}`);
  }
  // 접두 위장(`제안-x/`)을 막으려면 구분자까지 붙여 비교해야 한다.
  if (!rel.startsWith(`${PROPOSAL_DIR}/`)) {
    throw new Error(`제안 폴더의 문서만 옮길 수 있습니다: ${rel}`);
  }
  if (!rel.endsWith(".md")) {
    throw new Error(`.md 문서만 옮길 수 있습니다: ${rel}`);
  }
  if (!VAULT_CATEGORIES.includes(category)) {
    throw new Error(`알 수 없는 분류입니다: ${category}`);
  }

  const fileName = rel.slice(PROPOSAL_DIR.length + 1);
  const toRel = `${category}/${fileName}`;
  const from = resolve(vaultRoot, rel);
  const to = resolve(vaultRoot, toRel);

  // 정규화 뒤에도 볼트 안인지 본다 — 두 겹으로 막는다.
  const root = resolve(vaultRoot);
  for (const p of [from, to]) {
    if (p !== root && !p.startsWith(root + sep)) {
      throw new Error(`볼트 밖 경로입니다: ${p}`);
    }
  }

  return { from, to, toRel, fileName };
}
