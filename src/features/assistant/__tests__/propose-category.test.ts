import { describe, it, expect } from "vitest";
// vitest는 .mjs 상대 import를 지원한다 — 폴러가 실제로 쓰는 그 파일을 테스트한다.
import {
  CATEGORY_BY_DOMAIN,
  resolveProposalCategory,
  VAULT_CATEGORIES,
  classifiedBy,
} from "../../../../scripts/assistant/propose-lib.mjs";

/**
 * 분류를 사용자에게 묻지 않는다 — 운영자가 볼트 8칸을 외울 이유가 없다.
 *
 * 2026-08-18에 부산대 수시 인수인계를 넣으며 판정한 결과가 근거다:
 * 인수인계 내용은 **엔티티**다. "대상이 바뀌면 문서가 바뀌나"로 갈랐고,
 * 부산대를 빼면 그 내용이 성립하지 않는다. 플레이북은 대상 무관 절차다.
 *
 * 이 매핑이 안 맞는 사례가 나오면 그때가 분류를 다시 볼 신호다.
 */

describe("CATEGORY_BY_DOMAIN", () => {
  it("인수인계는 엔티티다", () => {
    expect(CATEGORY_BY_DOMAIN.handover).toBe("엔티티");
  });

  it("사고는 오류사례다", () => {
    expect(CATEGORY_BY_DOMAIN.incident).toBe("오류사례");
  });

  it("매핑된 값이 전부 실제 볼트 분류다", () => {
    // 오타 난 분류는 폴더가 없어 파일이 엉뚱한 데 생긴다.
    for (const [domain, category] of Object.entries(CATEGORY_BY_DOMAIN)) {
      expect(VAULT_CATEGORIES, `${domain} → ${category}`).toContain(category);
    }
  });
});

describe("resolveProposalCategory", () => {
  it("출처가 있으면 매핑을 쓰고 모델이 고른 값을 무시한다", () => {
    // 백단에서 정한다 — 모델이 매번 다르게 고르면 같은 종류가 흩어진다.
    expect(resolveProposalCategory("handover", "플레이북")).toBe("엔티티");
  });

  it("출처가 없으면 모델이 고른 분류를 쓴다", () => {
    expect(resolveProposalCategory(null, "규칙")).toBe("규칙");
  });

  it("모르는 출처는 조용히 넘기지 않고 던진다", () => {
    expect(() => resolveProposalCategory("nope", "규칙")).toThrow(/출처/);
  });

  it("둘 다 없으면 던진다 — 분류 없이 파일을 만들지 않는다", () => {
    expect(() => resolveProposalCategory(null, "")).toThrow(/분류/);
  });

  it("볼트에 없는 분류는 거부한다", () => {
    expect(() => resolveProposalCategory(null, "아무거나")).toThrow(/분류/);
  });
});

/**
 * 판정 주체를 문서에 남긴다.
 *
 * "운영자가 직접 10건을 쓴다"는 0단계 조건은 안 일어난다 — 앞으로도 에이전트가
 * 쓴다(2026-08-18 사용자 지적). 그러면 **8칸이 실제 지식을 담는지** 확인할 길이
 * 사라진다. 그래서 사람이 고른 것과 시스템이 정한 것을 구분해 남긴다.
 * 이게 쌓여야 "사람이 판정한 게 몇 건인가"를 셀 수 있다.
 */
describe("classifiedBy", () => {
  it("출처 매핑으로 정하면 시스템이다", () => {
    expect(classifiedBy("handover")).toBe("시스템");
  });

  it("출처가 없으면 사람이다 — 운영자에게 물어서 받은 값이다", () => {
    expect(classifiedBy(null)).toBe("사람");
  });
});
