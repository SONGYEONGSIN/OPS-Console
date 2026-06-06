"use client";

import { useState } from "react";
import type { ContractInfo } from "@/features/handover/schemas";
import {
  searchContractsByUniversity,
  type ContractSearchResult,
} from "@/features/contracts/actions";
import type { ContractMatch } from "@/features/contracts/match";
import { applyContractMatch } from "./contract-info-map";

type FieldKey = keyof Omit<ContractInfo, "memo">;

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "title", label: "제목" },
  { key: "type", label: "형태" },
  { key: "progress", label: "진행" },
  { key: "status", label: "상태" },
];

// 고정 옵션. status(상태)는 계약 메뉴 계약현황 distinct 값(statusOptions)으로 채운다.
const FIELD_OPTIONS: Record<FieldKey, readonly string[]> = {
  title: ["원서접수"],
  type: ["수의", "입찰"],
  progress: ["운영", "영업"],
  status: [],
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
  embedded = false,
  statusOptions = [],
}: {
  value: ContractInfo;
  onChange?: (next: ContractInfo) => void;
  readOnly?: boolean;
  universityName?: string;
  /** 아코디언 내부에 들어갈 때 — 자체 제목('계약정보')을 숨긴다. */
  embedded?: boolean;
  /** 상태(계약현황) 셀렉트 옵션 — 계약 메뉴 distinct 값 */
  statusOptions?: readonly string[];
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
    onChange?.(applyContractMatch(value, m.status));
    setMatches([]);
    setError(null);
  }

  return (
    <div className="space-y-1.5 text-xs">
      {(!embedded || canSearch) && (
        <div
          className={`flex items-center ${embedded ? "justify-end" : "justify-between"}`}
        >
          {!embedded && (
            <span className="font-bold text-ink-soft">계약정보</span>
          )}
          {canSearch && (
            <button
              type="button"
              onClick={runSearch}
              disabled={searching}
              className="cursor-pointer border-none bg-transparent p-0 text-2xs text-vermilion hover:text-vermilion-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searching ? "불러오는 중…" : "↓ 불러오기"}
            </button>
          )}
        </div>
      )}

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

      <div
        className={
          embedded
            ? "space-y-2"
            : "space-y-2 border-y border-line-soft py-3"
        }
      >
        {FIELDS.map((f) => {
          const baseOpts =
            f.key === "status" ? statusOptions : FIELD_OPTIONS[f.key];
          const cur = value[f.key];
          // 현재 값이 옵션에 없으면(레거시/자유값) 옵션에 추가해 유실 방지
          const opts =
            cur && !baseOpts.includes(cur) ? [cur, ...baseOpts] : baseOpts;
          return (
            <label key={f.key} className="flex items-center gap-2">
              <span className="w-10 flex-none text-muted">{f.label}</span>
              {readOnly ? (
                <span className="flex-1 text-ink">{cur || "—"}</span>
              ) : (
                <select
                  aria-label={f.label}
                  value={cur}
                  onChange={(e) =>
                    onChange?.({ ...value, [f.key]: e.target.value })
                  }
                  className="flex-1 border border-line bg-cream px-2 py-1 text-ink"
                >
                  <option value="">선택</option>
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              )}
            </label>
          );
        })}
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
