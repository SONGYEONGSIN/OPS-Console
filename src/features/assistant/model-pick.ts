/**
 * 여러 모델이 섞여 온다 — **대표는 비용이 가장 큰 쪽**이다.
 *
 * 그동안 `Object.keys(modelUsage)[0]` 로 첫 키를 집었다. 실측(2026-08-31):
 * haiku $0.005(2%) + opus $0.269(98%) 인데 **화면에는 haiku 가 떴다.**
 * 알파벳 순으로 haiku 가 앞이라서다. 답을 만든 건 opus 인데 대표가 뒤바뀌어,
 * "명보가 haiku 로 도는 줄" 알게 만들었다.
 *
 * 서버에 두는 이유: 표현을 고칠 때 회사 PC 를 안 만지려고. 폴러는 `modelUsage` 를
 * 그대로 넘기고 판단은 여기서 한다.
 */

type ModelEntry = {
  costUSD?: number;
  outputTokens?: number;
  /** `claude-opus-5[1m]` 같은 꼬리표가 없는 이름. 사람이 읽을 것은 이쪽이다. */
  canonicalModel?: string;
};

export function primaryModel(
  usage: Record<string, ModelEntry> | null | undefined,
): string | null {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;
  const rows = Object.entries(usage);
  if (rows.length === 0) return null;

  // 비용이 곧 비중이다. 비용이 안 오면 출력 토큰으로 대신 본다.
  const weight = (e: ModelEntry) => e?.costUSD ?? e?.outputTokens ?? 0;
  const [key, entry] = rows.reduce((best, cur) =>
    weight(cur[1]) > weight(best[1]) ? cur : best,
  );
  return entry?.canonicalModel || key;
}
