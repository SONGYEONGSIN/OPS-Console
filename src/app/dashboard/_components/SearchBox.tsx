"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { sidebarSections } from "../_data";
import { buildSearchItems, filterItems, type SearchItem } from "./searchItems";

/**
 * SearchBox — MenuBar 우측의 검색창. 47 메뉴를 부분 매치로 검색하고
 * 결과를 인라인 드롭다운으로 노출. ↑↓ Enter ESC 키보드 내비.
 * 검색 backend는 정적 sidebar 데이터 (47 항목).
 */
export function SearchBox() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const allItems = useMemo(() => buildSearchItems(sidebarSections), []);
  const results: SearchItem[] = useMemo(
    () => filterItems(allItems, query),
    [allItems, query],
  );

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  const showDropdown = open && query.trim().length > 0;
  const term = query.trim();
  const servicesSearchHref = `/dashboard/services?q=${encodeURIComponent(term)}`;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (!showDropdown || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) setActiveIdx((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0)
        setActiveIdx((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      const target = results[activeIdx];
      // 메뉴 매치가 있으면 해당 메뉴, 없으면 서비스(대학명·운영자·서비스명) 검색
      window.location.href = target
        ? `/dashboard/${target.slug}`
        : servicesSearchHref;
    }
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="flex w-full min-w-[240px] items-center gap-1.5 border border-line-soft bg-washi px-2.5 py-1">
        <svg viewBox="0 0 16 16" className="h-[11px] w-[11px] text-muted">
          <path
            d="M11 6.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zM10.5 10l3 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="서비스, 배치, 점검 항목 검색…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIdx(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 border-none bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
        />
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-[200] mt-1 border border-line bg-cream py-1 [box-shadow:4px_6px_0_rgba(21,18,12,0.15)]">
          {results.length > 0 ? (
            <ul role="listbox" className="flex flex-col">
              {results.map((r, i) => (
                <li key={r.slug}>
                  <Link
                    href={`/dashboard/${r.slug}`}
                    role="option"
                    aria-selected={i === activeIdx}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => setOpen(false)}
                    className={`grid grid-cols-[1fr_auto] items-baseline gap-2 px-3 py-1.5 text-sm transition-colors ${
                      i === activeIdx ? "bg-vermilion text-cream" : "text-ink"
                    }`}
                  >
                    <span className="truncate">{r.label}</span>
                    <span
                      className={`text-2xs tracking-[0.06em] ${
                        i === activeIdx ? "text-cream/80" : "text-muted"
                      }`}
                    >
                      {r.group}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {/* 메뉴 외 — 대학명·운영자·서비스명으로 서비스 검색 */}
          <Link
            href={servicesSearchHref}
            onClick={() => setOpen(false)}
            className={`block px-3 py-2 text-xs text-ink-soft hover:bg-washi-raised ${
              results.length > 0 ? "border-t border-line-soft" : ""
            }`}
          >
            서비스에서 <span className="font-semibold text-ink">{term}</span>{" "}
            검색 <span className="text-muted">· 대학명·운영자·서비스명</span>
          </Link>
        </div>
      )}
    </div>
  );
}
