import { describe, it, expect } from "vitest";
import { foldCost } from "../cost-fold";

/**
 * 에이전트가 얼마나 쓰는가 — 토큰·비용 합산.
 *
 * **0 과 null 을 가른다.** 0 은 '공짜로 돌았다', null 은 '안 남는다'다. 지금
 * 토큰을 남기는 건 어시스턴트 한 곳뿐이고 나머지 LLM 에이전트 5개는 회사 PC
 * 에서 `claude -p` 를 부르며 usage 를 안 받는다 — 그걸 0 으로 그리면 공짜로
 * 도는 것처럼 보인다.
 */
describe("foldCost", () => {
  const rows = [
    {
      input_tokens: 100,
      output_tokens: 20,
      cache_read_tokens: 5000,
      cost_usd: 0.12,
      model: "claude-opus-5",
    },
    {
      input_tokens: 300,
      output_tokens: 40,
      cache_read_tokens: 7000,
      cost_usd: 0.31,
      model: "claude-opus-5",
    },
  ];

  it("토큰과 비용을 더한다", () => {
    const r = foldCost(rows);
    expect(r).toEqual({
      inputTokens: 400,
      outputTokens: 60,
      cacheReadTokens: 12000,
      costUsd: 0.43,
      model: "claude-opus-5",
      runs: 2,
    });
  });

  /** 소수 합산은 부동소수라 0.43000000000000005 가 나온다 — 화면에 그대로 새면 안 된다. */
  it("비용은 센트 단위로 반올림한다", () => {
    expect(foldCost(rows)?.costUsd).toBe(0.43);
  });

  it("한 건도 없으면 null 이다 — 0 은 '공짜로 돌았다'로 읽힌다", () => {
    expect(foldCost([])).toBeNull();
  });

  /** 토큰이 안 붙은 옛 행이 섞여 있다. 그것 때문에 전체가 null 이 되면 안 된다. */
  it("토큰 없는 행은 건너뛰고 있는 것만 더한다", () => {
    const mixed = [
      ...rows,
      {
        input_tokens: null,
        output_tokens: null,
        cache_read_tokens: null,
        cost_usd: null,
        model: null,
      },
    ];
    expect(foldCost(mixed)?.runs).toBe(2);
  });

  it("모델이 섞이면 여럿임을 알린다 — 하나만 적으면 틀린다", () => {
    const two = [rows[0], { ...rows[1], model: "claude-sonnet-5" }];
    expect(foldCost(two)?.model).toBe("여러 모델");
  });
})
