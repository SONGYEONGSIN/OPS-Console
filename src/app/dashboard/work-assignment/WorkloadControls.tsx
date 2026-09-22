"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";

const DEBOUNCE_MS = 300;

const yearLabel = (y: number) => `${y}학년도`;

/**
 * 배정현황 조작줄 — **다른 목록 메뉴와 같은 자리, 같은 모양**(사용자 지적 2026-09-22).
 *
 * `ServicesControls` 가 정본이다: 검색창 + 필터 select 가 섹션 **밖** 한 줄에 서고
 * (`px-7 pt-3`), 검색은 300ms 뒤 한 번만 옮기며 `page` 를 버린다. 처음엔 섹션 머리
 * 오른쪽에 끼워 넣었는데, 그러면 **이 화면만 검색창 위치가 달랐다.**
 *
 * 학년도는 칩이 아니라 `ListSelect` 다 — 설계 문서가 그렇게 적었고(§ 머리에 학년도
 * 셀렉트), 다른 메뉴의 대학구분·카테고리 필터가 같은 자리에 같은 모양으로 선다.
 *
 * **다른 파라미터를 지우지 않는다.** 이 화면은 `?tab=` 으로 무엇을 볼지 정하는데,
 * 검색이 그걸 날리면 글자를 치는 순간 다른 탭으로 튄다. `page` 만 버린다 — 3쪽에서
 * 검색하면 결과가 한 쪽인데 빈 화면이 나온다.
 *
 * 걸러내는 것은 서버다(`filterWorkload`). 줄이 스물 남짓이라 클라이언트로 전건을
 * 보낼 이유가 없고, 무엇보다 **그룹 목표가 전원으로 낸 값이어야** 한다.
 */
export function WorkloadControls({ years }: { years: readonly number[] }) {
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

  /**
   * 주소에 없으면 **첫 값**이다 — 페이지의 `parseYear` 와 같은 기본값이라, 칸이
   * 비어 보이거나 화면과 다른 해를 가리키지 않는다.
   */
  const raw = Number(params.get("year"));
  const year = years.includes(raw) ? raw : (years[0] ?? raw);

  const pickYear = (label: string) => {
    const picked = years.find((y) => yearLabel(y) === label);
    if (picked === undefined) return;
    const next = new URLSearchParams(params.toString());
    next.set("year", String(picked));
    /*
     * 학년도가 바뀌면 사람도 대학도 달라진다 — 찾던 말이 그대로 남으면 빈 표가
     * 나오고, 사람은 '그 해에는 아무도 없다' 로 읽는다.
     */
    next.delete("q");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
    setQ("");
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-7 pt-3">
      <ListSearch
        value={q}
        onChange={setQ}
        ariaLabel="담당자·대학 검색"
        placeholder="담당자 이름 · 담당 대학 검색"
      />
      <ListSelect
        value={yearLabel(year)}
        onChange={pickYear}
        options={years.map(yearLabel)}
        ariaLabel="학년도 필터"
      />
    </div>
  );
}
