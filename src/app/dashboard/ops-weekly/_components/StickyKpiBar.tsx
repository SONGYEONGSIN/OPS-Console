"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** 바 높이를 부모(스크롤 컨테이너)에 알리는 CSS 변수 — 스크롤 목적지의 scroll-margin 이 읽는다. */
const KPI_HEIGHT_VAR = "--ops-kpi-h";

/**
 * 상단 건수 카드를 스크롤 컨테이너 위쪽에 붙인다 — lg 이상에서만.
 * lg 미만은 문서가 스크롤하는데 그 위 조상(content div·셸 그리드)이 스크롤 박스라 sticky 가 갇혀 동작하지 않고,
 * 폰에서는 카드가 화면의 3할을 가려 어차피 안 켠다.
 * 붙었는지는 바로 위 1px 표식이 화면 밖으로 나갔는지로 본다(IntersectionObserver 가 조상 클리핑까지 계산하므로
 * 스크롤 컨테이너를 찾을 필요가 없다). 붙었을 때 높이를 바꾸지 않는다 — 아래 내용이 튀어 오른다.
 */
export function StickyKpiBar({ children }: { children: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (el === null || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      // 같은 대상의 항목이 쌓여 올 수 있다 — 마지막이 현재 상태다.
      setStuck(!entries[entries.length - 1].isIntersecting);
    });
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, []);
  // 스크롤 목적지(하위 탭 줄·#unmatched)가 이 바 밑에 깔리지 않게 높이를 부모에 알린다.
  // 부모 = 스크롤 컨테이너다(page 는 Fragment, Provider 는 DOM 이 없다).
  useEffect(() => {
    const el = bar.current;
    const parent = el?.parentElement;
    if (!el || !parent || typeof ResizeObserver === "undefined") return;
    const write = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) parent.style.setProperty(KPI_HEIGHT_VAR, `${Math.ceil(h)}px`);
      else parent.style.removeProperty(KPI_HEIGHT_VAR);
    };
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => {
      ro.disconnect();
      parent.style.removeProperty(KPI_HEIGHT_VAR);
    };
  }, []);
  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <div
        ref={bar}
        data-stuck={stuck}
        className="border-b border-transparent bg-paper pb-3 lg:sticky lg:top-0 lg:z-20 lg:data-[stuck=true]:border-line-soft"
      >
        {children}
      </div>
    </>
  );
}
