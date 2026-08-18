/**
 * 지식망의 빈틈 — **client-safe** 부분(타입·라벨·묶기).
 *
 * Supabase 조회는 gaps.ts(server-only)에 있다. shared.ts와 같은 이유로 갈라둔다.
 */

export type GapKind = "missing" | "shallow" | "tool";

export type KnowledgeGapRow = {
  id: string;
  kind: GapKind;
  topic: string;
  note: string | null;
  nearPaths: string[];
  question: string;
  /** 같은 대화에서 만들어진 제안 초안 경로. 있으면 사람이 할 일은 '쓰기'가 아니라 '검토'다. */
  proposalPath: string | null;
  createdAt: string;
};

/**
 * 세 갈래는 **다른 일**을 뜻한다. 라벨이 그걸 말해야 사람이 헛일을 안 한다 —
 * shallow를 보고 새 문서를 쓰면 중복본이 생긴다.
 */
export const GAP_KIND_LABEL: Record<GapKind, string> = {
  missing: "문서 없음",
  shallow: "내용 부족 · 보강",
  tool: "도구 · 시스템 데이터",
};

export const GAP_KIND_TONE: Record<GapKind, string> = {
  missing: "bg-vermilion/10 text-vermilion",
  shallow: "bg-situation-bg text-ink",
  tool: "bg-line-soft text-ink-soft",
};

export type KnowledgeGapGroup = {
  topic: string;
  kind: GapKind;
  count: number;
  /** 원문 질문들 — 무엇을 써야 하는지는 요약이 아니라 원문이 알려준다. */
  questions: string[];
  /** shallow일 때 보강 대상 문서 */
  nearPaths: string[];
  notes: string[];
  /** 이 주제로 이미 만들어진 초안 — 있으면 또 쓸 일이 아니다. */
  proposalPath: string | null;
};

/**
 * 주제별로 묶고 많이 물어본 순으로 정렬한다.
 *
 * 반복이 곧 우선순위다 — 한 번 물어본 것보다 세 번 물어본 것을 먼저 쓴다.
 */
export function groupGaps(rows: KnowledgeGapRow[]): KnowledgeGapGroup[] {
  const byTopic = new Map<string, KnowledgeGapRow[]>();
  for (const r of rows) {
    const list = byTopic.get(r.topic);
    if (list) list.push(r);
    else byTopic.set(r.topic, [r]);
  }

  const groups: KnowledgeGapGroup[] = [];
  for (const [topic, list] of byTopic) {
    // 구분이 섞이면 더 많이 나온 쪽을 따른다 — 모델이 매번 같게 고르지는 않는다.
    const kindCount = new Map<GapKind, number>();
    for (const r of list) kindCount.set(r.kind, (kindCount.get(r.kind) ?? 0) + 1);
    const kind = [...kindCount.entries()].sort((a, b) => b[1] - a[1])[0][0];

    const questions: string[] = [];
    const nearPaths: string[] = [];
    const notes: string[] = [];
    for (const r of list) {
      if (!questions.includes(r.question)) questions.push(r.question);
      for (const p of r.nearPaths) if (!nearPaths.includes(p)) nearPaths.push(p);
      if (r.note && !notes.includes(r.note)) notes.push(r.note);
    }

    // 초안은 주제당 하나면 충분하다 — 여러 개면 가장 최근(정렬상 앞) 것을 쓴다.
    const proposalPath = list.find((r) => r.proposalPath)?.proposalPath ?? null;

    groups.push({
      topic,
      kind,
      count: list.length,
      questions,
      nearPaths,
      notes,
      proposalPath,
    });
  }

  return groups.sort((a, b) => b.count - a.count);
}
