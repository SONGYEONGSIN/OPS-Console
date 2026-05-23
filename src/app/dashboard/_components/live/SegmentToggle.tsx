"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Props = { mine: boolean };

/**
 * SegmentToggle — 실시간 현황 전용 세그먼트 토글
 * "전체 관점" | "내 업무만"
 * URL ?mine=true|undefined 로직
 */
export function SegmentToggle({ mine }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(nextMine: boolean) {
    const sp = new URLSearchParams(params.toString());
    if (nextMine) sp.set("mine", "true");
    else sp.delete("mine");
    const q = sp.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  const baseBtn =
    "text-sm font-semibold px-4 py-1.5 transition-colors cursor-pointer";
  const active = "bg-ink text-cream";
  const inactive = "bg-transparent text-ink hover:bg-washi-raised";

  return (
    <div className="inline-flex border border-ink p-0.5">
      <button
        type="button"
        onClick={() => go(false)}
        className={`${baseBtn} ${!mine ? active : inactive}`}
      >
        전체 관점
      </button>
      <button
        type="button"
        onClick={() => go(true)}
        className={`${baseBtn} ${mine ? active : inactive}`}
      >
        내 업무만
      </button>
    </div>
  );
}
