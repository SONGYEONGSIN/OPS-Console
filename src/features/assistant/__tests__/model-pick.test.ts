import { describe, it, expect } from "vitest";
import { primaryModel } from "../model-pick";

/**
 * 여러 모델이 섞여 온다 — **대표는 비용이 가장 큰 쪽**이다.
 *
 * 그동안 `Object.keys(modelUsage)[0]` 로 첫 키를 집었다. 실측(2026-08-31):
 * haiku $0.005 (2%) + opus $0.269 (98%) 인데 **화면에는 haiku 가 떴다.**
 * 알파벳 순으로 haiku 가 앞이라서다. 답을 만든 건 opus 인데 대표가 뒤바뀌었다.
 */
const real = {
  "claude-haiku-4-5-20251001": { costUSD: 0.005009, canonicalModel: "claude-haiku-4-5" },
  "claude-opus-5[1m]": { costUSD: 0.268806, canonicalModel: "claude-opus-5" },
};

describe("primaryModel", () => {
  it("비용이 가장 큰 모델이 대표다", () => {
    expect(primaryModel(real)).toBe("claude-opus-5");
  });

  it("첫 키를 집지 않는다 — 이게 뒤바뀐 원인이었다", () => {
    expect(primaryModel(real)).not.toBe("claude-haiku-4-5");
  });

  it("canonicalModel 을 쓴다 — `[1m]` 같은 꼬리표는 사람이 읽을 이름이 아니다", () => {
    expect(primaryModel(real)).not.toContain("[1m]");
  });

  it("canonicalModel 이 없으면 키를 그대로 쓴다", () => {
    expect(primaryModel({ "some-model": { costUSD: 1 } })).toBe("some-model");
  });

  it("하나뿐이면 그것", () => {
    expect(primaryModel({ "claude-opus-5[1m]": { costUSD: 0.1, canonicalModel: "claude-opus-5" } })).toBe("claude-opus-5");
  });

  it("비용이 없으면 토큰이 가장 많은 쪽 — 비용이 안 올 수도 있다", () => {
    expect(
      primaryModel({
        a: { outputTokens: 10 },
        b: { outputTokens: 900 },
      }),
    ).toBe("b");
  });

  it("비어 있거나 모양이 다르면 null — 지어내지 않는다", () => {
    expect(primaryModel(null)).toBeNull();
    expect(primaryModel({})).toBeNull();
    expect(primaryModel("이상한값" as never)).toBeNull();
  });
});
