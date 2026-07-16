"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type NewsKeywordCount = { keyword: string; count: number };

/**
 * 운영부 뉴스 — 수집 키워드 칩 필터(?keyword).
 * 칩 클릭 시 set, 활성 칩 재클릭 시 해제. 변경 시 page 리셋.
 * 배지 표준: 인사이트 영상 수집 칩과 동일 — 활성 버밀리언 솔리드,
 * 라벨에 건수 표기 `키워드 (N)`, 헤더 우측 정렬(ml-auto).
 */
export function NewsKeywordChips({
  keywords,
}: {
  keywords: readonly NewsKeywordCount[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("keyword") ?? "";

  if (keywords.length === 0) return null;

  const total = keywords.reduce((sum, k) => sum + k.count, 0);

  const select = (kw: string) => {
    const next = new URLSearchParams(params.toString());
    if (kw && kw !== active) next.set("keyword", kw);
    else next.delete("keyword");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  const chipClass = (isActive: boolean) =>
    `cursor-pointer border px-3 py-1 text-xs transition-colors ${
      isActive
        ? "border-vermilion bg-vermilion text-cream"
        : "border-line bg-paper text-ink hover:bg-line-soft"
    }`;

  return (
    <div
      role="group"
      aria-label="키워드 필터"
      className="ml-auto flex flex-wrap items-center gap-1"
    >
      <button
        type="button"
        onClick={() => select("")}
        className={chipClass(active === "")}
      >
        전체 ({total})
      </button>
      {keywords.map(({ keyword, count }) => (
        <button
          key={keyword}
          type="button"
          onClick={() => select(keyword)}
          className={chipClass(active === keyword)}
        >
          {keyword} ({count})
        </button>
      ))}
    </div>
  );
}
