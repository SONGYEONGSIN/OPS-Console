"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";

const DEBOUNCE_MS = 300;

/**
 * 배정현황 검색창 — `?q=` 규약은 목록 화면들과 같다(`ServicesControls` 가 정본).
 *
 * **다른 파라미터를 지우지 않는다.** 이 화면은 `?tab=` 과 `?year=` 로 무엇을 볼지
 * 정하는데, 검색이 그걸 날리면 글자를 치는 순간 2027학년도 배정현황으로 튄다.
 * `page` 만 버린다 — 3쪽에서 검색하면 결과가 한 쪽인데 빈 화면이 나온다.
 *
 * 걸러내는 것은 서버다(`filterWorkload`). 줄이 스물 남짓이라 클라이언트로 전건을
 * 보낼 이유가 없고, 무엇보다 **그룹 목표가 전원으로 낸 값이어야** 한다.
 */
export function WorkloadControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    const current = params.get("q") ?? "";
    // 주소와 같으면 옮기지 않는다 — push 가 다시 이 effect 를 깨워 무한 루프가 된다.
    if (q.trim() === current) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q, pathname, params, router]);

  return (
    <ListSearch
      value={q}
      onChange={setQ}
      ariaLabel="담당자·대학 검색"
      placeholder="담당자 이름 · 담당 대학 검색"
      className="max-w-sm"
    />
  );
}
