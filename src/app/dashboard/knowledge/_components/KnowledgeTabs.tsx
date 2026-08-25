import Link from "next/link";

/**
 * 지식망 화면의 네 칸.
 *
 * 전에는 한 화면에 문서·초안 폼·빈틈·검토 대기가 세로로 쌓여 있었다. 문서를
 * 보러 온 사람에게 초안 폼이 먼저 보이는 순서였고, 검토해야 할 초안은 빈틈
 * 목록 아래로 밀려 닫혀 보였다.
 *
 * **기다리는 건수를 탭 이름에 붙인다** — 안 붙이면 방치돼도 아무도 모른다.
 * 다만 0은 안 붙인다. 늘 붙어 있는 숫자는 신호가 아니라 배경이 된다.
 */

export type KnowledgeTab = "docs" | "draft" | "review" | "gaps";

const TABS: { key: KnowledgeTab; label: string }[] = [
  { key: "docs", label: "문서" },
  { key: "draft", label: "초안 만들기" },
  { key: "review", label: "검토 대기" },
  { key: "gaps", label: "빈틈" },
];

export function KnowledgeTabs({
  active,
  reviewCount,
  gapCount,
}: {
  active: KnowledgeTab;
  reviewCount: number;
  gapCount: number;
}) {
  const countOf = (key: KnowledgeTab) =>
    key === "review" ? reviewCount : key === "gaps" ? gapCount : 0;

  return (
    <div className="px-7">
      <div role="tablist" className="flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const isActive = active === t.key;
          const count = countOf(t.key);
          return (
            <Link
              key={t.key}
              role="tab"
              aria-selected={isActive}
              // 문서 탭은 doc 선택을 안 달고 나간다 — 늘 목록에서 시작한다.
              href={
                t.key === "docs"
                  ? "/dashboard/knowledge"
                  : `/dashboard/knowledge?tab=${t.key}`
              }
              className={`-mb-px px-4 py-2 text-sm ${
                isActive
                  ? "border-b-2 border-vermilion font-semibold text-vermilion"
                  : "border-b-2 border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className="ml-1.5 tabular-nums text-2xs text-muted">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
