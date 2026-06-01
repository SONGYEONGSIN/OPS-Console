"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const REFRESH_SEC = 30;

/**
 * 상단 PageMeta 영역에 노출되는 자동 새로고침 카운트다운.
 * 30초 1초씩 감소 → 0 도달 시 router.refresh() 호출 후 30 리셋.
 * 탭 비활성 시 pause.
 *
 * router.refresh()는 인터벌 콜백(이펙트 컨텍스트)에서 직접 호출한다.
 * setState 업데이터 안에서 호출하면 React가 업데이터를 렌더 중 재실행할 때
 * "렌더 중 다른 컴포넌트(Router) 업데이트" 위반이 발생해 트리가 불안정해진다
 * (인스펙터/모달이 닫히는 부작용).
 */
export function AutoRefreshCountdown() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(REFRESH_SEC);
  const remainingRef = useRef(REFRESH_SEC);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      const next = remainingRef.current - 1;
      if (next <= 0) {
        remainingRef.current = REFRESH_SEC;
        setCountdown(REFRESH_SEC);
        router.refresh();
      } else {
        remainingRef.current = next;
        setCountdown(next);
      }
    }, 1_000);
    return () => window.clearInterval(id);
  }, [router]);

  return (
    <span aria-live="polite" aria-label={`다음 자동 새로고침 ${countdown}초`}>
      자동 새로고침 {String(countdown).padStart(2, "0")}s
    </span>
  );
}
