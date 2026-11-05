"use client";

import { useCallback, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { parseSchoolNo } from "@/features/sms-sender/filters";

/**
 * 인스펙터에 띄운 학교 — 화면 상태가 먼저고 주소(`?school=No`)는 따라간다.
 *
 * 예전엔 행을 누르면 `router.push(?school=)` 로 서버를 한 번 다녀와야 열렸다.
 * 지금은 상태로 바로 열고 주소는 `history.replaceState` 로만 맞춘다 — Next 가 그
 * 호출을 `useSearchParams` 에 반영하므로 서버 요청이 없다. 주소에 남기는 이유는
 * 딥링크(`?school=No`)와 새로고침이다. 다른 탭의 링크도 이 주소로 연다.
 *
 * 바깥에서 주소가 바뀌면(링크·뒤로 가기) 그 값으로 다시 맞춘다.
 */
export function useSelectedSchool(): [
  number | null,
  (no: number | null) => void,
] {
  const params = useSearchParams();
  const pathname = usePathname();
  const fromUrl = parseSchoolNo(params.get("school") ?? "");
  const [selected, setSelected] = useState<number | null>(fromUrl);
  const [seen, setSeen] = useState<number | null>(fromUrl);
  if (seen !== fromUrl) {
    setSeen(fromUrl);
    setSelected(fromUrl);
  }

  const select = useCallback(
    (no: number | null) => {
      setSelected(no);
      const next = new URLSearchParams(params.toString());
      if (no === null) next.delete("school");
      else next.set("school", String(no));
      const qs = next.toString();
      window.history.replaceState(
        null,
        "",
        qs ? `${pathname}?${qs}` : pathname,
      );
    },
    [params, pathname],
  );

  return [selected, select];
}
