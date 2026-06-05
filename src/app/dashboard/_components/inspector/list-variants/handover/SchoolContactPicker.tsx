"use client";

import { useState } from "react";
import type { SchoolContact } from "@/features/handover/schemas";

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
}: {
  candidates: SchoolContactCandidate[];
  items: SchoolContact[];
  onChange: (next: SchoolContact[]) => void;
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
      <span className="block text-muted">학교담당자</span>
      {candidates.length === 0 ? (
        <p className="text-2xs text-muted">
          등록된 대학 연락처가 없습니다. (대학연락처 메뉴에서 먼저 등록)
        </p>
      ) : (
        <div className="relative">
          <input
            type="text"
            aria-label="학교담당자 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="대학 연락처 검색 (이름/이메일) → 선택 시 추가"
            className="w-full border border-line bg-cream px-2 py-1 text-ink focus:border-vermilion focus:outline-none"
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
            <li
              key={c.id}
              className="flex items-stretch gap-2 border border-line bg-cream px-2 py-1.5"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-ink">
                  {c.name}
                  {c.jobTitle ? ` (${c.jobTitle})` : ""}
                </p>
                {c.phone ? (
                  <p className="truncate text-2xs text-muted">{c.phone}</p>
                ) : null}
                {c.email ? (
                  <p className="truncate text-2xs text-muted">{c.email}</p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={`${c.name} 삭제`}
                onClick={() => onChange(items.filter((it) => it.id !== c.id))}
                className="flex aspect-square flex-none cursor-pointer items-center justify-center border border-line bg-transparent text-muted hover:border-vermilion hover:text-vermilion"
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
