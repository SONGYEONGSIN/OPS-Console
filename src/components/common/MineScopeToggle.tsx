"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Props = {
  mineLabel: string;
  allLabel: string;
};

/**
 * 내것 | 전체 세그먼트 토글. ?mine 파라미터를 자체 처리한다.
 * 기본값 '내것': param 없으면 내것(true). 전체 선택 시 ?mine=false.
 */
export function MineScopeToggle({ mineLabel, allLabel }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const mine = searchParams.get("mine") !== "false";

  const handleChange = (nextMine: boolean) => {
    if (nextMine === mine) return;
    const sp = new URLSearchParams(searchParams.toString());
    if (nextMine) sp.delete("mine");
    else sp.set("mine", "false");
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  return (
    <div
      role="tablist"
      aria-label="범위 토글"
      className="flex items-center border border-line"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mine}
        onClick={() => handleChange(true)}
        className={`cursor-pointer px-3 py-1 text-xs ${
          mine
            ? "bg-ink text-cream"
            : "bg-transparent text-ink hover:text-vermilion"
        }`}
      >
        {mineLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={!mine}
        onClick={() => handleChange(false)}
        className={`cursor-pointer border-l border-line px-3 py-1 text-xs ${
          !mine
            ? "bg-ink text-cream"
            : "bg-transparent text-ink hover:text-vermilion"
        }`}
      >
        {allLabel}
      </button>
    </div>
  );
}
