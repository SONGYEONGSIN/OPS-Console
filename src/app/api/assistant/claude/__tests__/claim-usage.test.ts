import { describe, it, expect } from "vitest";
import { primaryModel } from "@/features/assistant/model-pick";

/**
 * 폴러가 보낸 `modelUsage` 로 대표 모델을 정한다.
 *
 * 실측 그대로의 모양으로 확인한다 — 첫 키(haiku, 2%)가 아니라 비용이 큰 쪽
 * (opus, 98%)이 대표여야 한다(2026-08-31).
 */
describe("claim: 대표 모델", () => {
  const real = {
    "claude-haiku-4-5-20251001": {
      inputTokens: 4909, outputTokens: 20, costUSD: 0.005009,
      canonicalModel: "claude-haiku-4-5",
    },
    "claude-opus-5[1m]": {
      inputTokens: 6, outputTokens: 585, costUSD: 0.268806,
      canonicalModel: "claude-opus-5",
    },
  };

  it("실측 모양에서 opus 를 고른다", () => {
    expect(primaryModel(real)).toBe("claude-opus-5");
  });

  it("폴러가 안 보내면 null — 옛 폴러가 섞여 돌아도 깨지지 않는다", () => {
    expect(primaryModel(undefined)).toBeNull();
  });
});
