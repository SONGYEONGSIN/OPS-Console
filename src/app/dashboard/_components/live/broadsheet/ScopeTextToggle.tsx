"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Props = { mine: boolean };

/**
 * ScopeTextToggle — broadsheet 마스트헤드용 전체 / 내 담당 텍스트 토글.
 * SegmentToggle 과 동일한 ?mine=true|undefined URL 로직, 텍스트 스타일.
 */
export function ScopeTextToggle({ mine }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(nextMine: boolean) {
    const sp = new URLSearchParams(params.toString());
    // 명시값으로 push — 기본값이 권한(admin=전체)에 따라 달라지므로 delete 대신 set.
    sp.set("mine", nextMine ? "true" : "false");
    const q = sp.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <span>
      <button
        type="button"
        onClick={() => go(false)}
        className={`cursor-pointer ${
          !mine ? "text-ink" : "text-muted hover:text-ink"
        }`}
      >
        전체
      </button>
      <span className="text-line-soft mx-1">/</span>
      <button
        type="button"
        onClick={() => go(true)}
        className={`cursor-pointer ${
          mine ? "text-ink" : "text-muted hover:text-ink"
        }`}
      >
        내 담당
      </button>
    </span>
  );
}
