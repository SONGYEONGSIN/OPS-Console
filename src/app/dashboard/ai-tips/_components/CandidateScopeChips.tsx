"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { CandidateStatus } from "@/features/ai-tip-candidates/schemas";

/** 기본으로 보는 칸. 주소에 `scope` 가 없으면 이것이다. */
const DEFAULT_SCOPE: CandidateStatus = "pending";

/** 화면 순서 — 할 일(검토 대기)이 먼저고, 지나간 것이 뒤다. */
const CHIPS: { scope: CandidateStatus; label: string }[] = [
  { scope: "pending", label: "검토 대기" },
  { scope: "hidden", label: "숨김" },
  { scope: "promoted", label: "등록됨" },
];

type Props = {
  /** 상태별 후보 수 — 서버가 세어 넘긴다. */
  counts: Record<CandidateStatus, number>;
};

/**
 * TIP 후보 상태 칩 — `?scope=pending|hidden|promoted` 택일.
 *
 * **공용 `ScopeChips` 를 쓰지 않는다.** 그쪽은 `?mine` 2치 토글로 하드코딩돼 있고
 * 열 곳 넘게 쓴다 — 3치를 밀어 넣으려면 그 전부를 건드려야 한다.
 *
 * 기본은 검토 대기다. 평소에 볼 것은 아직 결정 안 한 후보뿐이고, 숨김·등록됨은
 * 되짚어 볼 때만 연다. 기본으로 돌아갈 땐 `scope` 를 **지운다** — 주소에 기본값을
 * 적어두면 나중에 기본이 바뀌어도 예전 주소가 옛 화면에 갇힌다.
 */
export function CandidateScopeChips({ counts }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("scope");
  const current: CandidateStatus =
    CHIPS.find((c) => c.scope === raw)?.scope ?? DEFAULT_SCOPE;

  function go(next: CandidateStatus) {
    const q = new URLSearchParams(params.toString());
    if (next === DEFAULT_SCOPE) q.delete("scope");
    else q.set("scope", next);
    // 3쪽을 보던 중에 칸을 옮기면 그쪽엔 3쪽이 없어 빈 화면이 뜬다.
    q.delete("page");
    router.push(`${pathname}?${q.toString()}`);
  }

  return (
    <div className="inline-flex">
      {CHIPS.map(({ scope, label }) => {
        const on = current === scope;
        return (
          <button
            key={scope}
            type="button"
            aria-label={label}
            aria-pressed={on}
            onClick={() => go(scope)}
            className={`relative cursor-pointer border-none bg-transparent px-3 py-1 text-sm transition-colors ${
              on ? "font-bold text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {label}
            <span className="ml-1 text-2xs font-normal tabular-nums text-muted">
              {counts[scope]}
            </span>
            {on && (
              <span
                aria-hidden
                className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
