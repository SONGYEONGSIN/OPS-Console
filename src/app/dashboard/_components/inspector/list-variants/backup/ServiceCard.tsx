"use client";

import { useState } from "react";
import { ListSearch } from "@/components/common/ListSearch";

export type ServiceCardDetail = {
  id: string;
  service_id: number;
  service_name: string;
  university_name: string;
  substitute_email?: string | null;
  substitute_name?: string | null;
  contacts: string[];
  note_md: string | null;
};

type Operator = { email: string; name: string };
type ContactCandidate = {
  id: string;
  customer_name: string;
  university_name: string;
};

type Props = {
  detail: ServiceCardDetail;
  backupOperators: Operator[];
  contactCandidates: ContactCandidate[];
  onSubstituteChange: (email: string | null, name: string | null) => void;
  onContactsChange: (contacts: string[]) => void;
  onNoteChange: (note: string | null) => void;
  onRemove: () => void;
  /** PR-5: false면 헤더의 백업자 select 미렌더링 (single mode에서 사용) */
  showSubstituteSelect?: boolean;
};

const MAX_CONTACTS = 20;

function formatContactLabel(c: ContactCandidate): string {
  return `${c.university_name} — ${c.customer_name}`;
}

export function ServiceCard({
  detail,
  backupOperators,
  contactCandidates,
  onSubstituteChange,
  onContactsChange,
  onNoteChange,
  onRemove,
  showSubstituteSelect = true,
}: Props) {
  const [contactQuery, setContactQuery] = useState("");

  const trimmed = contactQuery.trim();
  const matches =
    trimmed.length === 0
      ? []
      : contactCandidates
          .filter((c) => {
            const label = formatContactLabel(c);
            return (
              !detail.contacts.includes(label) &&
              (c.university_name.includes(trimmed) ||
                c.customer_name.includes(trimmed))
            );
          })
          .slice(0, 10);

  function addContact(c: ContactCandidate) {
    if (detail.contacts.length >= MAX_CONTACTS) return;
    onContactsChange([...detail.contacts, formatContactLabel(c)]);
    setContactQuery("");
  }

  function removeContact(label: string) {
    onContactsChange(detail.contacts.filter((x) => x !== label));
  }

  return (
    <div className="border border-line-soft bg-washi-raised p-2.5">
      {/* 헤더: 대학명 — 서비스명 / 백업자 select(옵션) / × */}
      <div className="flex items-center gap-2">
        <span className="flex-1 text-2xs text-ink-soft">
          {detail.university_name} — {detail.service_name}
        </span>
        {showSubstituteSelect && (
          <select
            aria-label={`${detail.service_name} 백업자`}
            value={detail.substitute_email ?? ""}
            onChange={(e) => {
              const email = e.target.value;
              const op = backupOperators.find((o) => o.email === email);
              onSubstituteChange(email || null, op?.name ?? null);
            }}
            className="border border-line bg-cream px-1 py-0 text-2xs text-ink"
          >
            <option value="">선택…</option>
            {backupOperators.map((op) => (
              <option key={op.email} value={op.email}>
                {op.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          aria-label={`${detail.service_name} 제거`}
          onClick={onRemove}
          className="cursor-pointer border-none bg-transparent px-0.5 text-muted hover:text-vermilion"
        >
          ×
        </button>
      </div>

      {/* 연락처: 검색 + chips */}
      <div className="mt-2">
        <span className="mb-1 block text-2xs text-muted">
          대학 연락처 ({detail.contacts.length}/{MAX_CONTACTS})
        </span>
        <ListSearch
          value={contactQuery}
          onChange={setContactQuery}
          placeholder="대학명·고객명 검색"
          ariaLabel={`${detail.service_name} 대학 연락처 검색`}
          size="sm"
        />
        {matches.length > 0 && (
          <ul
            aria-label={`${detail.service_name} 대학 연락처 검색 결과`}
            className="mt-1 max-h-40 overflow-y-auto border border-line-soft bg-cream"
          >
            {matches.map((c) => (
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
        {detail.contacts.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {detail.contacts.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 bg-line-soft px-2 py-0.5 text-2xs text-ink-soft"
              >
                <span>{label}</span>
                <button
                  type="button"
                  aria-label={`${label} 제거`}
                  onClick={() => removeContact(label)}
                  className="cursor-pointer border-none bg-transparent px-0.5 text-muted hover:text-vermilion"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 메모 */}
      <div className="mt-2">
        <span className="mb-1 block text-2xs text-muted">서비스 메모</span>
        <textarea
          aria-label={`${detail.service_name} 메모`}
          value={detail.note_md ?? ""}
          onChange={(e) => onNoteChange(e.target.value || null)}
          rows={2}
          maxLength={2000}
          placeholder="이 서비스만의 디테일 (Markdown)"
          className="w-full border border-line bg-cream px-2 py-1 text-2xs text-ink"
        />
      </div>
    </div>
  );
}
