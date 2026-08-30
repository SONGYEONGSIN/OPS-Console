/**
 * 에이전트 토큰·비용 합산 — 순수 함수.
 *
 * **0 과 null 을 가른다.** 0 은 '공짜로 돌았다', null 은 '안 남는다'다.
 * 지금 토큰을 남기는 건 어시스턴트 한 곳뿐이고, 나머지 LLM 에이전트 5개는
 * 회사 PC 에서 `claude -p` 를 부르며 usage 를 안 받는다 — 그걸 0 으로 그리면
 * 공짜로 도는 것처럼 보인다.
 */
export type AgentCost = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  /** 기간 안에 모델이 섞이면 "여러 모델". 하나만 적으면 틀린다. */
  model: string;
  /** 합산에 들어간 실행 수. */
  runs: number;
};

type Row = {
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cost_usd: number | null;
  model: string | null;
};

export function foldCost(rows: Row[]): AgentCost | null {
  // 토큰이 안 붙은 옛 행이 섞여 있다. 그것 때문에 전체가 null 이 되면 안 된다.
  const counted = rows.filter((r) => r.input_tokens !== null);
  if (counted.length === 0) return null;

  const models = new Set(counted.map((r) => r.model).filter(Boolean));
  const sum = (pick: (r: Row) => number | null) =>
    counted.reduce((acc, r) => acc + (pick(r) ?? 0), 0);

  return {
    inputTokens: sum((r) => r.input_tokens),
    outputTokens: sum((r) => r.output_tokens),
    cacheReadTokens: sum((r) => r.cache_read_tokens),
    // 소수 합산은 부동소수라 0.43000000000000005 가 나온다 — 센트로 끊는다.
    costUsd: Math.round(sum((r) => r.cost_usd) * 100) / 100,
    model: models.size === 1 ? [...models][0]! : "여러 모델",
    runs: counted.length,
  };
}
