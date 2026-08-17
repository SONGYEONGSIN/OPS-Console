import Link from "next/link";
import {
  GAP_KIND_LABEL,
  GAP_KIND_TONE,
  type KnowledgeGapGroup,
} from "@/features/knowledge/gaps-shared";

/**
 * 어시스턴트가 답하지 못한 것 — 지식망에 무엇이 빠졌는지.
 *
 * 문서를 안 고른 상태의 오른쪽 칸에 둔다. "좌측에서 문서를 선택하세요"만 있던
 * 자리인데, 볼트에 무엇을 더 써야 하는지가 여기 있는 편이 낫다.
 *
 * 자동으로 문서를 쓰지는 않는다 — 검증 없이 쌓인 지식이 틀리면 그걸 근거로 답이
 * 나가고 그 답이 다시 쌓인다(설계 §8). 사람이 보고 쓰는 것이 이 화면의 전부다.
 */
export function KnowledgeGaps({ groups }: { groups: KnowledgeGapGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="border border-line-soft bg-situation-bg px-6 py-10 text-sm text-muted">
        어시스턴트가 답하지 못한 질문이 없습니다. 좌측에서 문서를 선택하세요.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1 border-b-2 border-ink pb-3">
        <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
          지식망 빈틈
        </p>
        <h2 className="text-xl font-bold tracking-[-0.01em] text-ink">
          어시스턴트가 답하지 못한 것
        </h2>
        <p className="text-xs text-muted">
          많이 물어본 순입니다. 문서는 옵시디언에서 직접 쓰거나 고칩니다.
        </p>
      </div>

      <ul className="space-y-4">
        {groups.map((g) => (
          <li key={g.topic} className="space-y-1.5 border-b border-line-soft pb-4">
            <div className="flex items-baseline gap-2">
              <span
                className={`shrink-0 px-1.5 py-0.5 text-2xs ${GAP_KIND_TONE[g.kind]}`}
              >
                {GAP_KIND_LABEL[g.kind]}
              </span>
              <span className="text-sm font-medium text-ink">{g.topic}</span>
              <span className="ml-auto shrink-0 font-mono text-2xs text-muted">
                {g.count}회
              </span>
            </div>

            {/* 무엇을 써야 하는지는 요약이 아니라 원문이 알려준다 */}
            <ul className="space-y-0.5">
              {g.questions.map((q) => (
                <li key={q} className="text-xs text-ink-soft">
                  “{q}”
                </li>
              ))}
            </ul>

            {g.notes.length > 0 && (
              <p className="text-2xs text-muted">{g.notes.join(" · ")}</p>
            )}

            {/* shallow는 새로 쓸 일이 아니라 이 문서를 고칠 일이다 */}
            {g.nearPaths.length > 0 && (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-0.5">
                <span className="text-2xs text-muted">보강 대상</span>
                {g.nearPaths.map((p) => (
                  <Link
                    key={p}
                    href={`/dashboard/knowledge?doc=${encodeURIComponent(p)}`}
                    className="text-2xs text-vermilion hover:underline"
                  >
                    {p.replace(/\.md$/, "")}
                  </Link>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
