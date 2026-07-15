"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * 운영부 뉴스 — 수집 키워드 칩 필터(?keyword).
 * 칩 클릭 시 set, 활성 칩 재클릭 시 해제. 변경 시 page 리셋.
 * 선택 표준: border-vermilion bg-vermilion/10 text-vermilion (#846).
 */
export function NewsKeywordChips({
  keywords,
}: {
  keywords: readonly string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("keyword") ?? "";

  if (keywords.length === 0) return null;

  const select = (kw: string) => {
    const next = new URLSearchParams(params.toString());
    if (kw && kw !== active) next.set("keyword", kw);
    else next.delete("keyword");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  const chipClass = (isActive: boolean) =>
    `cursor-pointer border px-2.5 py-0.5 text-xs transition-colors ${
      isActive
        ? "border-vermilion bg-vermilion/10 text-vermilion"
        : "border-line-soft bg-transparent text-muted hover:bg-line-soft hover:text-ink"
    }`;

  return (
    <div
      role="group"
      aria-label="키워드 필터"
      className="flex flex-wrap items-center gap-1.5"
    >
      <button
        type="button"
        onClick={() => select("")}
        className={chipClass(active === "")}
      >
        전체
      </button>
      {keywords.map((kw) => (
        <button
          key={kw}
          type="button"
          onClick={() => select(kw)}
          className={chipClass(active === kw)}
        >
          {kw}
        </button>
      ))}
    </div>
  );
}
