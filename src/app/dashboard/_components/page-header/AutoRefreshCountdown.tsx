"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const REFRESH_SEC = 30;

/**
 * 상단 PageMeta 영역에 노출되는 자동 새로고침 카운트다운.
 * 30초 1초씩 감소 → 0 도달 시 router.refresh() 호출 후 30 리셋.
 * 탭 비활성 시 pause.
 */
export function AutoRefreshCountdown() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(REFRESH_SEC);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      setCountdown((prev) => {
        if (prev <= 1) {
          router.refresh();
          return REFRESH_SEC;
        }
        return prev - 1;
      });
    }, 1_000);
    return () => window.clearInterval(id);
  }, [router]);

  return (
    <span aria-live="polite" aria-label={`다음 자동 새로고침 ${countdown}초`}>
      자동 새로고침 {String(countdown).padStart(2, "0")}s
    </span>
  );
}
