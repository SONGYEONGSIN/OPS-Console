"use client";

import { useState } from "react";

export type SchoolContactCandidate = {
  name: string;
  jobTitle: string | null;
  phone: string | null;
  email: string | null;
};

/** 후보 → 본문에 추가할 텍스트 블록 (이름(직함) / 전화 / 이메일). */
function formatContact(c: SchoolContactCandidate): string {
  return [
    `${c.name}${c.jobTitle ? ` (${c.jobTitle})` : ""}`,
    c.phone ?? "",
    c.email ?? "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * 컨텍 — 학교담당자. 해당 대학 연락처를 검색해 선택하면 본문(텍스트)에 추가한다.
 * 텍스트는 그대로 편집 가능(자유 형식 유지).
 */
export function SchoolContactPicker({
  candidates,
  value,
  onChange,
}: {
  candidates: SchoolContactCandidate[];
  value: string;
  onChange: (next: string) => void;
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
    const block = formatContact(c);
    onChange(value.trim() ? `${value}\n\n${block}` : block);
    setSearch("");
  }

  return (
    <div className="space-y-2">
      <div className="text-xs">
        <span className="mb-1 block text-muted">학교담당자</span>
        {candidates.length === 0 ? (
          <p className="text-2xs text-muted">
            등록된 대학 연락처가 없습니다. (대학연락처 메뉴에서 먼저 등록)
          </p>
        ) : (
          <>
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
                className="mt-1 max-h-40 overflow-y-auto border border-line-soft bg-washi-raised"
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
          </>
        )}
      </div>
      <textarea
        aria-label="학교담당자 내용"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        maxLength={10000}
        placeholder="연락처를 검색해 추가하거나 직접 입력하세요."
        className="w-full border border-line bg-cream px-2 py-1 text-ink"
      />
    </div>
  );
}
