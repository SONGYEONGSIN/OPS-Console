"use client";

import { useState } from "react";
import type { ContractInfo } from "@/features/handover/schemas";
import {
  searchContractsByUniversity,
  type ContractSearchResult,
} from "@/features/contracts/actions";
import type { ContractMatch } from "@/features/contracts/match";

const FIELDS: { key: keyof Omit<ContractInfo, "memo">; label: string }[] = [
  { key: "title", label: "제목" },
  { key: "type", label: "형태" },
  { key: "progress", label: "진행" },
  { key: "status", label: "상태" },
];

const PLACEHOLDER: Record<string, string> = {
  title: "예: 원서접수",
  type: "예: 수의",
  progress: "예: 운영자",
  status: "예: 완료",
};

/**
 * 계약정보 — 고정 필드 폼(제목/형태/진행/상태 + 메모). 편집·읽기 겸용.
 * 편집 모드 + universityName 제공 시 계약(contracts) 검색 → 진행/상태 자동 채움.
 */
export function ContractInfoForm({
  value,
  onChange,
  readOnly = false,
  universityName,
}: {
  value: ContractInfo;
  onChange?: (next: ContractInfo) => void;
  readOnly?: boolean;
  universityName?: string;
}) {
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<ContractMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canSearch = !readOnly && !!universityName?.trim();

  async function runSearch() {
    if (!universityName) return;
    setSearching(true);
    setError(null);
    const res: ContractSearchResult =
      await searchContractsByUniversity(universityName);
    setSearching(false);
    if (res.ok) {
      setMatches(res.matches);
      if (res.matches.length === 0) setError("일치하는 계약 건이 없습니다.");
    } else {
      setError(res.error);
    }
  }

  function applyMatch(m: ContractMatch) {
    onChange?.({ ...value, progress: m.operator, status: m.status });
    setMatches([]);
    setError(null);
  }

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-ink-soft">계약정보</span>
        {canSearch && (
          <button
            type="button"
            onClick={runSearch}
            disabled={searching}
            className="cursor-pointer border-none bg-transparent p-0 text-2xs text-vermilion hover:text-vermilion-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searching ? "검색 중…" : "계약에서 가져오기"}
          </button>
        )}
      </div>

      {!readOnly && matches.length > 0 && (
        <ul
          aria-label="계약 검색 결과"
          className="max-h-40 space-y-0.5 overflow-y-auto border border-line-soft bg-washi-raised p-1"
        >
          {matches.map((m, i) => (
            <li key={`${m.sheet}-${m.numbering}-${i}`}>
              <button
                type="button"
                onClick={() => applyMatch(m)}
                className="block w-full cursor-pointer border-none bg-transparent px-2 py-1 text-left text-2xs text-ink hover:bg-line-soft"
              >
                <span className="text-ink">{m.name}</span>
                <span className="ml-1 text-muted">
                  {m.operator ? `· 진행 ${m.operator}` : ""}
                  {m.status ? ` · 상태 ${m.status}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!readOnly && error && <p className="text-2xs text-muted">{error}</p>}

      <div className="space-y-2 border-y border-line-soft py-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex items-center gap-2">
            <span className="w-10 flex-none text-muted">{f.label}</span>
            {readOnly ? (
              <span className="flex-1 text-ink">{value[f.key] || "—"}</span>
            ) : (
              <input
                aria-label={f.label}
                value={value[f.key]}
                onChange={(e) =>
                  onChange?.({ ...value, [f.key]: e.target.value })
                }
                maxLength={f.key === "title" ? 200 : 100}
                placeholder={PLACEHOLDER[f.key]}
                className="flex-1 border border-line bg-cream px-2 py-1 text-ink"
              />
            )}
          </label>
        ))}
        <label className="block">
          <span className="mb-1 block text-muted">메모</span>
          {readOnly ? (
            <div className="min-h-[3.5rem] w-full whitespace-pre-wrap border border-line bg-cream px-2 py-1 text-ink">
              {value.memo || <span className="text-faint">—</span>}
            </div>
          ) : (
            <textarea
              aria-label="계약정보 메모"
              value={value.memo}
              onChange={(e) => onChange?.({ ...value, memo: e.target.value })}
              rows={2}
              maxLength={2000}
              placeholder="예: ※ 학부 계약시 포함"
              className="w-full border border-line bg-cream px-2 py-1 text-ink"
            />
          )}
        </label>
      </div>
    </div>
  );
}
