import Link from "next/link";
import type { PendingProposal } from "@/features/knowledge/gaps-types";

/**
 * 검토 대기 중인 초안 — 에이전트가 써놓고 사람을 기다리는 것.
 *
 * '빈틈'과 한 칸에 있었는데 성격이 다르다. 빈틈은 **아직 없는 것**이고 이건
 * **이미 있는데 아무도 안 본 것**이다. 한 칸에 두면 검토할 초안이 빈틈 목록
 * 아래로 밀려 닫혀 보인다.
 *
 * 옮기는 건 여기서 안 한다 — `제안/` 은 사람이 내용을 읽고 넘기는 관문이라,
 * 목록에서 버튼 한 번으로 넘어가면 그 관문이 사라진다.
 */
export function PendingProposals({
  proposals,
}: {
  proposals: PendingProposal[];
}) {
  if (proposals.length === 0) {
    return (
      <p className="border border-line-soft bg-situation-bg px-6 py-10 text-sm text-muted">
        기다리는 초안이 없습니다. ‘초안 만들기’에서 파일이나 내용을 넣으면 여기에
        쌓입니다.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1 border-b-2 border-ink pb-3">
        <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
          검토 대기
        </p>
        <h2 className="text-xl font-bold tracking-[-0.01em] text-ink">
          아직 아무도 안 본 초안 {proposals.length}건
        </h2>
        <p className="text-xs text-muted">
          에이전트가 쓴 것입니다. 눌러서 내용을 확인하고, 맞으면 옵시디언에서 본
          위치로 옮기세요.
        </p>
      </div>

      <ul className="space-y-0.5">
        {proposals.map((p) => (
          <li key={p.path}>
            <Link
              href={`/dashboard/knowledge?doc=${encodeURIComponent(p.path)}`}
              className="-mx-1.5 block px-1.5 py-1.5 text-sm text-ink transition-colors hover:bg-line-soft"
            >
              {p.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
