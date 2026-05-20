"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { sidebarSections } from "../_data";
import { buildSearchItems, filterItems, type SearchItem } from "./searchItems";
import { searchAllAction } from "@/features/search/action";
import type { SearchResults } from "@/features/search/queries";

const SVC_DEBOUNCE_MS = 250;

const EMPTY_RESULTS: SearchResults = {
  services: [],
  contacts: [],
  incidents: [],
  handover: [],
  receivables: [],
};

const DOMAIN_LABELS: { key: keyof SearchResults; label: string }[] = [
  { key: "services", label: "서비스" },
  { key: "contacts", label: "대학연락처" },
  { key: "incidents", label: "사고" },
  { key: "handover", label: "인수인계" },
  { key: "receivables", label: "미수채권" },
];

/**
 * SearchBox — chrome 검색창. 메뉴(정적 47) + 도메인 데이터(services / contacts /
 * incidents / handover / receivables 동적) 통합 검색. 입력 시 debounce server action.
 */
export function SearchBox() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [domainHits, setDomainHits] = useState<SearchResults>(EMPTY_RESULTS);
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

  // 도메인 통합 동적 검색 (debounce). 빈 쿼리 포함 setState를 timer 안에서.
  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    const id = setTimeout(() => {
      if (q.length < 1) {
        if (!cancelled) setDomainHits(EMPTY_RESULTS);
        return;
      }
      searchAllAction(q)
        .then((r) => {
          if (!cancelled) setDomainHits(r);
        })
        .catch(() => {
          if (!cancelled) setDomainHits(EMPTY_RESULTS);
        });
    }, SVC_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  const hasDomainHits = DOMAIN_LABELS.some(
    (d) => domainHits[d.key].length > 0,
  );

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
          {/* 도메인 통합 동적 검색 결과 (서비스/연락처/사고/인수인계) */}
          {DOMAIN_LABELS.map((d) => {
            const hits = domainHits[d.key];
            if (hits.length === 0) return null;
            return (
              <ul
                key={d.key}
                role="listbox"
                className="flex flex-col border-t border-line-soft"
              >
                <li className="px-3 pb-0.5 pt-1.5 text-2xs uppercase tracking-[0.14em] text-muted">
                  {d.label}
                </li>
                {hits.map((h) => (
                  <li key={`${d.key}-${h.id}`}>
                    <Link
                      href={h.href}
                      onClick={() => setOpen(false)}
                      className="grid grid-cols-[1fr_auto] items-baseline gap-2 px-3 py-1.5 text-sm text-ink hover:bg-washi-raised"
                    >
                      <span className="truncate">
                        {h.primary}{" "}
                        <span className="text-muted">· {h.secondary}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            );
          })}
          {/* 매치 0건 안내 */}
          {results.length === 0 && !hasDomainHits ? (
            <p className="px-3 py-2 text-xs text-muted">검색 결과 없음</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
