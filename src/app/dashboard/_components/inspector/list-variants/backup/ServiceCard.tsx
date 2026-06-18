"use client";

import { useState } from "react";
import { ListSearch } from "@/components/common/ListSearch";

/** PR-5: 인스펙터 chip의 contact 스냅샷 형식 — schemas.ts contactDetailSchema와 동일 */
export type ContactDetail = {
  contact_id: string;
  customer_name: string;
  university_name: string;
  email: string | null;
  phone: string | null;
  ext?: string | null;
};

export type ServiceCardDetail = {
  id: string;
  service_id: number;
  service_name: string;
  university_name: string;
  substitute_email?: string | null;
  substitute_name?: string | null;
  contacts: ContactDetail[];
  note_md: string | null;
};

type Operator = { email: string; name: string };
type ContactCandidate = {
  id: string;
  customer_name: string;
  university_name: string;
  email: string | null;
  phone: string | null;
  ext?: string | null;
};

type Props = {
  detail: ServiceCardDetail;
  backupOperators: Operator[];
  contactCandidates: ContactCandidate[];
  onSubstituteChange: (email: string | null, name: string | null) => void;
  onContactsChange: (contacts: ContactDetail[]) => void;
  onNoteChange: (note: string | null) => void;
  onRemove: () => void;
  /** PR-5: false면 헤더의 백업자 select 미렌더링 (single mode에서 사용) */
  showSubstituteSelect?: boolean;
};

const MAX_CONTACTS = 20;

/** 인스펙터 chip 라벨 — 이메일/전화 미노출 (사용자 요청: 메일 발송에만 노출) */
function chipLabel(c: ContactDetail): string {
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
  const selectedIds = new Set(detail.contacts.map((c) => c.contact_id));
  const matches =
    trimmed.length === 0
      ? []
      : contactCandidates
          .filter(
            (c) =>
              !selectedIds.has(c.id) &&
              (c.university_name.includes(trimmed) ||
                c.customer_name.includes(trimmed)),
          )
          .slice(0, 10);

  function addContact(c: ContactCandidate) {
    if (detail.contacts.length >= MAX_CONTACTS) return;
    const snapshot: ContactDetail = {
      contact_id: c.id,
      customer_name: c.customer_name,
      university_name: c.university_name,
      email: c.email,
      phone: c.phone,
      ext: c.ext ?? null,
    };
    onContactsChange([...detail.contacts, snapshot]);
    setContactQuery("");
  }

  function removeContact(contactId: string) {
    onContactsChange(detail.contacts.filter((x) => x.contact_id !== contactId));
  }

  return (
    <div className="border border-line-soft bg-paper p-2.5">
      {/* 헤더: 대학명 — 서비스명(서비스ID) / × */}
      <div className="flex items-center gap-2">
        <span className="flex-1 text-xs font-semibold text-ink">
          {detail.university_name} — {detail.service_name}({detail.service_id})
        </span>
        <button
          type="button"
          aria-label={`${detail.service_name} 제거`}
          onClick={onRemove}
          className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center border border-line bg-paper text-2xl leading-none text-ink-soft transition-colors hover:border-vermilion hover:text-vermilion"
        >
          ×
        </button>
      </div>

      {/* 백업자 (서비스별 모드에서만) — 대학 연락처 위 별도 항목 */}
      {showSubstituteSelect && (
        <div className="mt-2">
          <span className="mb-1 block text-xs text-ink-soft">백업자</span>
          <select
            aria-label={`${detail.service_name} 백업자`}
            value={detail.substitute_email ?? ""}
            onChange={(e) => {
              const email = e.target.value;
              const op = backupOperators.find((o) => o.email === email);
              onSubstituteChange(email || null, op?.name ?? null);
            }}
            className="w-full border border-line bg-cream transition-colors focus:border-ink focus:bg-white px-2 py-1 text-xs text-ink"
          >
            <option value="">선택…</option>
            {backupOperators.map((op) => (
              <option key={op.email} value={op.email}>
                {op.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 연락처: 검색 + chips */}
      <div className="mt-2">
        <span className="mb-1 block text-xs text-ink-soft">
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
            className="mt-1 max-h-40 overflow-y-auto border border-line-soft bg-white"
          >
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => addContact(c)}
                  className="block w-full cursor-pointer border-none bg-transparent px-2 py-1 text-left text-xs text-ink hover:bg-washi-raised"
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
            {detail.contacts.map((c) => {
              const label = chipLabel(c);
              return (
                <span
                  key={c.contact_id}
                  className="inline-flex items-center gap-1 bg-line-soft px-2 py-0.5 text-2xs text-ink-soft"
                >
                  <span>{label}</span>
                  <button
                    type="button"
                    aria-label={`${label} 제거`}
                    onClick={() => removeContact(c.contact_id)}
                    className="cursor-pointer border-none bg-transparent px-0.5 text-muted hover:text-vermilion"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* 메모 */}
      <div className="mt-2">
        <span className="mb-1 block text-xs text-ink-soft">서비스 메모</span>
        <textarea
          aria-label={`${detail.service_name} 메모`}
          value={detail.note_md ?? ""}
          onChange={(e) => onNoteChange(e.target.value || null)}
          rows={2}
          maxLength={2000}
          placeholder="이 서비스만의 디테일 (Markdown)"
          className="w-full border border-line bg-cream transition-colors focus:border-ink focus:bg-white px-2 py-1 text-xs text-ink"
        />
      </div>
    </div>
  );
}
