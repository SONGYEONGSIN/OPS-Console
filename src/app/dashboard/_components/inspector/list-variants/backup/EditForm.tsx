"use client";

import { useState } from "react";
import type { EditFormProps } from "../types";
import { ListSearch } from "@/components/common/ListSearch";

type ServiceCandidate = {
  id: string;
  service_id: number;
  service_name: string;
  university_name: string;
};

type ContactCandidate = {
  id: string;
  customer_name: string;
  university_name: string;
};

export function BackupForm({
  row,
  setRow,
  onSave,
  onCancel,
  backupOperators = [],
  backupServiceCandidates = [],
  backupContactCandidates = [],
}: EditFormProps) {
  // PR-2: services multi-select 상태 — 후보 검색 + 선택 chips
  const selectedIds = row.backupServices ?? [];
  const selectedDetail = row.backupServicesDetail ?? [];
  const [query, setQuery] = useState("");

  // 대학 연락처 multi-select 상태 (담당 서비스와 동일 패턴)
  const selectedContactIds = row.backupContacts ?? [];
  const selectedContactsDetail = row.backupContactsDetail ?? [];
  const [contactQuery, setContactQuery] = useState("");

  const trimmedQuery = query.trim();
  const matches: ServiceCandidate[] =
    trimmedQuery.length === 0
      ? []
      : backupServiceCandidates
          .filter(
            (c) =>
              !selectedIds.includes(c.id) &&
              (c.university_name.includes(trimmedQuery) ||
                c.service_name.includes(trimmedQuery)),
          )
          .slice(0, 10);

  const trimmedContactQuery = contactQuery.trim();
  const contactMatches: ContactCandidate[] =
    trimmedContactQuery.length === 0
      ? []
      : backupContactCandidates
          .filter(
            (c) =>
              !selectedContactIds.includes(c.id) &&
              (c.university_name.includes(trimmedContactQuery) ||
                c.customer_name.includes(trimmedContactQuery)),
          )
          .slice(0, 10);

  function addService(c: ServiceCandidate) {
    if (selectedIds.length >= 20) return;
    setRow({
      ...row,
      backupServices: [...selectedIds, c.id],
      backupServicesDetail: [...selectedDetail, c],
    });
    setQuery("");
  }

  function removeService(id: string) {
    setRow({
      ...row,
      backupServices: selectedIds.filter((x) => x !== id),
      backupServicesDetail: selectedDetail.filter((x) => x.id !== id),
    });
  }

  function addContact(c: ContactCandidate) {
    if (selectedContactIds.length >= 20) return;
    setRow({
      ...row,
      backupContacts: [...selectedContactIds, c.id],
      backupContactsDetail: [...selectedContactsDetail, c],
    });
    setContactQuery("");
  }

  function removeContact(id: string) {
    setRow({
      ...row,
      backupContacts: selectedContactIds.filter((x) => x !== id),
      backupContactsDetail: selectedContactsDetail.filter((x) => x.id !== id),
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      {row.owner && (
        <div className="block text-xs">
          <span className="mb-1 block text-muted">요청자</span>
          <p className="border border-line-soft bg-washi-raised px-2 py-1 text-ink">
            {row.owner}
            <span className="ml-1 text-2xs text-muted">(본인 자동 입력)</span>
          </p>
        </div>
      )}

      <label className="block text-xs">
        <span className="mb-1 block text-muted">제목</span>
        <input
          aria-label="제목"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          maxLength={120}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="예: 5/20~25 휴가 백업"
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">백업자</span>
        <select
          aria-label="백업자"
          value={row.substituteEmail ?? ""}
          onChange={(e) => {
            const email = e.target.value;
            const op = backupOperators.find((o) => o.email === email);
            setRow({
              ...row,
              substituteEmail: email,
              substituteName: op?.name ?? "",
            });
          }}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          <option value="">선택…</option>
          {backupOperators.map((op) => (
            <option key={op.email} value={op.email}>
              {op.name} ({op.email})
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">휴가/외근 시작일</span>
          <input
            aria-label="휴가 시작일"
            type="date"
            value={row.leaveStartDate ?? ""}
            onChange={(e) =>
              setRow({ ...row, leaveStartDate: e.target.value || null })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>

        <label className="block text-xs">
          <span className="mb-1 block text-muted">휴가/외근 종료일</span>
          <input
            aria-label="휴가 종료일"
            type="date"
            value={row.leaveEndDate ?? ""}
            onChange={(e) =>
              setRow({ ...row, leaveEndDate: e.target.value || null })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      </div>

      {/* PR-2: 담당 서비스 multi-select — 검색 + click으로만 추가, max 20 */}
      <div className="block text-xs">
        <span className="mb-1 flex items-baseline justify-between text-muted">
          <span>담당 서비스 ({selectedIds.length}/20)</span>
        </span>
        <ListSearch
          value={query}
          onChange={setQuery}
          placeholder="대학명·서비스명 검색"
          ariaLabel="담당 서비스 검색"
          size="sm"
        />
        {matches.length > 0 && (
          <ul
            aria-label="담당 서비스 검색 결과"
            className="mt-1 max-h-48 overflow-y-auto border border-line-soft bg-washi-raised"
          >
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => addService(c)}
                  className="block w-full cursor-pointer border-none bg-transparent px-2 py-1 text-left text-2xs text-ink hover:bg-line-soft"
                >
                  <span className="text-ink-soft">{c.university_name}</span>
                  <span className="mx-1 text-muted">—</span>
                  <span>{c.service_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedDetail.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedDetail.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 bg-line-soft px-2 py-0.5 text-2xs text-ink-soft"
              >
                <span>
                  {s.university_name} — {s.service_name}
                </span>
                <button
                  type="button"
                  aria-label={`${s.service_name} 제거`}
                  onClick={() => removeService(s.id)}
                  className="cursor-pointer border-none bg-transparent px-0.5 text-muted hover:text-vermilion"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 대학 연락처 multi-select — contacts 도메인 검색 dropdown (담당 서비스와 동일 패턴) */}
      <div className="block text-xs">
        <span className="mb-1 flex items-baseline justify-between text-muted">
          <span>대학 연락처 ({selectedContactIds.length}/20)</span>
        </span>
        <ListSearch
          value={contactQuery}
          onChange={setContactQuery}
          placeholder="대학명·고객명 검색"
          ariaLabel="대학 연락처 검색"
          size="sm"
        />
        {contactMatches.length > 0 && (
          <ul
            aria-label="대학 연락처 검색 결과"
            className="mt-1 max-h-48 overflow-y-auto border border-line-soft bg-washi-raised"
          >
            {contactMatches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => addContact(c)}
                  className="block w-full cursor-pointer border-none bg-transparent px-2 py-1 text-left text-2xs text-ink hover:bg-line-soft"
                >
                  <span className="text-ink-soft">{c.university_name}</span>
                  <span className="mx-1 text-muted">—</span>
                  <span>{c.customer_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedContactsDetail.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedContactsDetail.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 bg-line-soft px-2 py-0.5 text-2xs text-ink-soft"
              >
                <span>
                  {c.university_name} — {c.customer_name}
                </span>
                <button
                  type="button"
                  aria-label={`${c.customer_name} 제거`}
                  onClick={() => removeContact(c.id)}
                  className="cursor-pointer border-none bg-transparent px-0.5 text-muted hover:text-vermilion"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">백업 내용</span>
        <textarea
          aria-label="백업 내용"
          value={row.summary ?? ""}
          onChange={(e) => setRow({ ...row, summary: e.target.value })}
          rows={6}
          maxLength={5000}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="진행 상태, 마감, 주의사항 (Markdown 가능)"
        />
      </label>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
    </form>
  );
}
