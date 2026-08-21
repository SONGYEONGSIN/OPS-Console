import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  resolvePromotion,
  PROPOSAL_DIR,
  VAULT_CATEGORIES,
} from "../../../../scripts/assistant/promote-lib.mjs";

/**
 * 검토를 마친 초안을 본 위치로 옮긴다.
 *
 * `제안/` 은 "사람이 읽은 것만 본 위치에 들어간다"는 관문이다. 채팅에서 내용을
 * 그대로 보여주고 사람이 "맞다"고 하면 그게 검토다 — 옵시디언을 여는 것과 판단의
 * 질이 다르지 않다(2026-08-21).
 *
 * 다만 **`제안/` 에서 나가는 방향만** 연다. 본 위치 문서를 옮기거나 지우는 건
 * 여러 사람이 함께 쓰는 파일이라 채팅 한 마디로 바뀌면 안 된다.
 */
describe("resolvePromotion", () => {
  const root = "C:/vault";

  it("제안 문서를 분류 폴더로 옮긴다", () => {
    const r = resolvePromotion(root, "제안/부산대학교 수시 서비스 세팅.md", "엔티티");
    expect(r.toRel).toBe("엔티티/부산대학교 수시 서비스 세팅.md");
    expect(r.from).toContain(PROPOSAL_DIR);
  });

  it("제안 폴더 밖은 거절한다 — 본 위치 문서를 옮기지 않는다", () => {
    expect(() =>
      resolvePromotion(root, "엔티티/공문 채번 규칙.md", "플레이북"),
    ).toThrow(/제안/);
  });

  it("상위 참조를 막는다 — 정규화 전에 본다", () => {
    expect(() =>
      resolvePromotion(root, "제안/../../etc/passwd.md", "개념"),
    ).toThrow();
  });

  it("볼트 안으로 되돌아오는 상위 참조도 막는다 — 다른 방어를 다 통과한다", () => {
    //  으로 시작하고 정규화 뒤에도 볼트 안이라, 접두 검사와 범위 검사를
    // 모두 지나간다. 이것만 상위 참조 검사가 잡는다 — 본 위치 문서를 옮기는 길이다.
    expect(() =>
      resolvePromotion(root, "제안/../엔티티/공문 채번 규칙.md", "플레이북"),
    ).toThrow();
  });

  it("접두 위장을 막는다 — `제안-x/` 는 제안 폴더가 아니다", () => {
    expect(() => resolvePromotion(root, "제안-x/a.md", "개념")).toThrow(/제안/);
  });

  it("모르는 분류는 거절한다 — 없는 폴더를 만들지 않는다", () => {
    expect(() =>
      resolvePromotion(root, "제안/a.md", "새로운분류"),
    ).toThrow(/분류/);
  });

  it("분류 여덟 칸만 받는다", () => {
    for (const c of VAULT_CATEGORIES) {
      expect(() => resolvePromotion(root, "제안/a.md", c)).not.toThrow();
    }
  });

  it(".md 만 옮긴다", () => {
    expect(() => resolvePromotion(root, "제안/a.txt", "개념")).toThrow(/\.md/);
  });

  it("대상 경로가 볼트 안인지 한 번 더 본다 — 두 겹으로 막는다", () => {
    const r = resolvePromotion(root, "제안/a.md", "개념");
    // OS 구분자는 다를 수 있다(Windows 역슬래시) — 볼트 아래인지만 본다.
    expect(resolve(r.to).startsWith(resolve(root))).toBe(true);
    expect(r.toRel).toBe("개념/a.md");
  });
});
