"use client";

import { useState } from "react";
import type { SchoolContact } from "@/features/handover/schemas";
import { CopyButton } from "./CopyButton";

export type SchoolContactCandidate = {
  name: string;
  jobTitle: string | null;
  phone: string | null;
  email: string | null;
};

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `sc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * 컨텍 — 학교담당자. 해당 대학 연락처를 검색해 선택하면 구조화 리스트에 추가한다.
 * 각 담당자는 개별 행(이름(직함)/전화/이메일)으로 표시되고 × 로 개별 삭제한다.
 */
export function SchoolContactPicker({
  candidates,
  items,
  onChange,
  embedded = false,
}: {
  candidates: SchoolContactCandidate[];
  items: SchoolContact[];
  onChange: (next: SchoolContact[]) => void;
  /** 아코디언 내부 — 자체 제목('학교담당자')을 숨긴다. */
  embedded?: boolean;
}) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const matches =
    term === ""
      ? []
      : candidates.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            (c.email ?? "").toLowerCase().includes(term),
        );

  function add(c: SchoolContactCandidate) {
    const dup = items.some(
      (it) => it.name === c.name && (it.email ?? "") === (c.email ?? ""),
    );
    if (!dup) {
      onChange([
        ...items,
        {
          id: newId(),
          name: c.name,
          jobTitle: c.jobTitle,
          phone: c.phone,
          email: c.email,
        },
      ]);
    }
    setSearch("");
  }

  return (
    <div className="space-y-2 text-xs">
      {!embedded && (
        <span className="block font-bold text-ink-soft">학교담당자</span>
      )}
      {candidates.length === 0 ? (
        <p className="text-2xs text-muted">
          등록된 대학 연락처가 없습니다. (대학연락처 메뉴에서 먼저 등록)
        </p>
      ) : (
        <div className="relative">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-[0.95rem] h-3.5 w-3.5 -translate-y-1/2 text-muted"
          >
            <circle
              cx="7"
              cy="7"
              r="4.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="m11 11 3 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="text"
            aria-label="학교담당자 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="대학 연락처 검색 (이름/이메일) → 선택 시 추가"
            className="w-full border border-line bg-cream py-1 pl-7 pr-2 text-ink transition-colors focus:border-ink focus:bg-white"
          />
          {matches.length > 0 && (
            <ul
              aria-label="연락처 검색 결과"
              className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto border border-line-soft bg-washi-raised"
            >
              {matches.map((c, i) => (
                <li key={`${c.email ?? c.name}-${i}`}>
                  <button
                    type="button"
                    onClick={() => add(c)}
                    className="block w-full cursor-pointer border-none bg-transparent px-2 py-1 text-left text-2xs text-ink hover:bg-line-soft"
                  >
                    {c.name}
                    {c.jobTitle ? ` (${c.jobTitle})` : ""}
                    {c.phone ? ` · ${c.phone}` : ""}
                    {c.email ? ` · ${c.email}` : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="border border-dashed border-line-soft bg-cream px-2 py-2 text-2xs text-muted">
          추가된 학교담당자가 없습니다.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              {/* 한 줄 표시 — 이름(직함) · 전화 · 이메일[복사]. 박스는 내용만, X는 박스 밖. */}
              <div className="flex min-w-0 flex-1 items-center gap-x-2 overflow-hidden whitespace-nowrap border border-line bg-cream px-2 py-1.5">
                <span className="flex-none text-ink">
                  {c.name}
                  {c.jobTitle ? ` (${c.jobTitle})` : ""}
                </span>
                {c.phone ? (
                  <span className="flex-none text-2xs text-muted">
                    · {c.phone}
                  </span>
                ) : null}
                {c.email ? (
                  <span className="flex min-w-0 items-center gap-1 text-2xs text-muted">
                    <span className="truncate">· {c.email}</span>
                    <CopyButton value={c.email} label={`${c.name} 이메일`} />
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={`${c.name} 삭제`}
                onClick={() => onChange(items.filter((it) => it.id !== c.id))}
                className="flex-none cursor-pointer border border-line bg-transparent px-2 py-1 text-muted transition-colors hover:border-ink hover:bg-ink hover:text-cream"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
