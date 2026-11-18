"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 상단 건수 카드를 스크롤 컨테이너 위쪽에 붙인다 — lg 이상에서만.
 * lg 미만은 문서가 스크롤하는데 그 위 조상(content div·셸 그리드)이 스크롤 박스라 sticky 가 갇혀 동작하지 않고,
 * 폰에서는 카드가 화면의 3할을 가려 어차피 안 켠다.
 * 붙었는지는 바로 위 1px 표식이 화면 밖으로 나갔는지로 본다(IntersectionObserver 가 조상 클리핑까지 계산하므로
 * 스크롤 컨테이너를 찾을 필요가 없다). 붙었을 때 높이를 바꾸지 않는다 — 아래 내용이 튀어 오른다.
 */
export function StickyKpiBar({ children }: { children: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (el === null || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      setStuck(!entry.isIntersecting);
    });
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, []);
  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <div
        data-stuck={stuck}
        className="border-b border-transparent bg-paper pb-3 lg:sticky lg:top-0 lg:z-20 lg:data-[stuck=true]:border-line-soft"
      >
        {children}
      </div>
    </>
  );
}
