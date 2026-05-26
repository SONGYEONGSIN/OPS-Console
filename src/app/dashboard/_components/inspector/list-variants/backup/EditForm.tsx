"use client";

import { useState, type FormEvent } from "react";
import type { EditFormProps } from "../types";
import type { ListRow } from "../../../patterns/ListPattern";
import { ListSearch } from "@/components/common/ListSearch";
import { ServiceCard, type ServiceCardDetail } from "./ServiceCard";

type Mode = "single" | "perService";

type ServiceCandidate = {
  id: string;
  service_id: number;
  service_name: string;
  university_name: string;
};

const MAX_SERVICES = 20;

/**
 * PR-6: row hydrate 시 백업자 모드 추론 — DB에 assign_mode 컬럼 두지 않고 데이터 분포로 판정.
 * - 서비스 없음 → single (default)
 * - 서비스 substitute_email distinct ≥ 2 → perService
 * - distinct 1개인데 parent substitute_email과 다름 → perService (parent fallback 케이스)
 * - 그 외 → single
 *
 * perService에서 모든 서비스가 같은 백업자로 지정된 경우 single과 구분 불가하지만
 * 의미적으로 동일한 발송 결과를 만들므로 single 표시로 충분 (데이터 손실 없음).
 */
function inferMode(row: ListRow): Mode {
  const details = row.backupServicesDetail ?? [];
  if (details.length === 0) return "single";
  const distinctEmails = new Set(
    details
      .map((d) => d.substitute_email)
      .filter((e): e is string => Boolean(e)),
  );
  if (distinctEmails.size >= 2) return "perService";
  const [only] = distinctEmails;
  if (only && only !== row.substituteEmail) return "perService";
  return "single";
}

export function BackupForm({
  row,
  setRow,
  onSave,
  onCancel,
  backupOperators = [],
  backupServiceCandidates = [],
  backupContactCandidates = [],
}: EditFormProps) {
  const selectedIds = row.backupServices ?? [];
  const selectedDetail: ServiceCardDetail[] = row.backupServicesDetail ?? [];
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>(() => inferMode(row));
  /** PR-6: 발송 모드 (now=즉시, schedule=예약). row.sendMode가 있으면 hydrate. */
  const [sendMode, setSendMode] = useState<"now" | "schedule">(
    row.sendMode ?? "now",
  );
  /** PR-6: 예약 시각 KST datetime-local string. 신규 등록 전용 — 기존 row 편집은 본 PR 범위 외. */
  const [scheduledAtInput, setScheduledAtInput] = useState(
    row.scheduledAtInput ?? "",
  );

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

  function addService(c: ServiceCandidate) {
    if (selectedIds.length >= MAX_SERVICES) return;
    const newDetail: ServiceCardDetail = {
      id: c.id,
      service_id: c.service_id,
      service_name: c.service_name,
      university_name: c.university_name,
      substitute_email: null,
      substitute_name: null,
      contacts: [],
      note_md: null,
    };
    setRow({
      ...row,
      backupServices: [...selectedIds, c.id],
      backupServicesDetail: [...selectedDetail, newDetail],
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

  function updateService(id: string, patch: Partial<ServiceCardDetail>) {
    const next = selectedDetail.map((x) =>
      x.id === id ? { ...x, ...patch } : x,
    );
    setRow({ ...row, backupServicesDetail: next });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // PR-6: 발송 모드 + 예약 시각을 row에 운반 → page.tsx onPersist가 createBackupRequest에 전달
    const withSendMode: typeof row = {
      ...row,
      sendMode,
      scheduledAtInput: sendMode === "schedule" ? scheduledAtInput : "",
    };
    if (mode === "perService") {
      // DB의 backup_requests.substitute_email NOT NULL 충족용 — 첫 명시 카드의 백업자를 parent로
      const firstAssigned = selectedDetail.find((s) => s.substitute_email);
      if (firstAssigned && !withSendMode.substituteEmail) {
        onSave({
          ...withSendMode,
          substituteEmail: firstAssigned.substitute_email ?? "",
          substituteName: firstAssigned.substitute_name ?? "",
        });
        return;
      }
    }
    onSave(withSendMode);
  }

  return (
    <form
      onSubmit={handleSubmit}
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

      {/* PR-5: 백업자 설정 세그먼트 컨트롤 */}
      <div className="block text-xs" role="radiogroup" aria-label="백업자 설정">
        <span className="mb-1 block text-muted">백업자 설정</span>
        <div className="flex w-full border border-line">
          <button
            type="button"
            aria-pressed={mode === "single"}
            onClick={() => setMode("single")}
            className={`flex-1 cursor-pointer border-none px-3 py-1.5 text-xs ${
              mode === "single"
                ? "bg-ink text-cream"
                : "bg-cream text-ink hover:bg-washi"
            }`}
          >
            1명 일괄
          </button>
          <button
            type="button"
            aria-pressed={mode === "perService"}
            onClick={() => setMode("perService")}
            className={`flex-1 cursor-pointer border-none border-l border-line px-3 py-1.5 text-xs ${
              mode === "perService"
                ? "bg-ink text-cream"
                : "bg-cream text-ink hover:bg-washi"
            }`}
          >
            서비스별
          </button>
        </div>
      </div>

      {mode === "single" && (
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
      )}

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

      {/* 백업 서비스 — 검색 + 카드 컬렉션 */}
      <div className="block text-xs">
        <span className="mb-1 flex items-baseline justify-between text-muted">
          <span>백업 서비스 ({selectedIds.length}/{MAX_SERVICES})</span>
        </span>
        <ListSearch
          value={query}
          onChange={setQuery}
          placeholder="대학명·서비스명 검색"
          ariaLabel="백업 서비스 검색"
          size="sm"
        />
        {matches.length > 0 && (
          <ul
            aria-label="백업 서비스 검색 결과"
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
          <div className="mt-2 flex flex-col gap-2">
            {selectedDetail.map((s) => (
              <ServiceCard
                key={s.id}
                detail={s}
                backupOperators={backupOperators}
                contactCandidates={backupContactCandidates}
                showSubstituteSelect={mode === "perService"}
                onSubstituteChange={(email, name) =>
                  updateService(s.id, {
                    substitute_email: email,
                    substitute_name: name,
                  })
                }
                onContactsChange={(contacts) =>
                  updateService(s.id, { contacts })
                }
                onNoteChange={(note_md) => updateService(s.id, { note_md })}
                onRemove={() => removeService(s.id)}
              />
            ))}
          </div>
        )}
      </div>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">공통 메모</span>
        <textarea
          aria-label="공통 메모"
          value={row.summary ?? ""}
          onChange={(e) => setRow({ ...row, summary: e.target.value })}
          rows={6}
          maxLength={5000}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="전체 휴가 컨텍스트 — 일정·인사말 (Markdown 가능)"
        />
      </label>

      {/* PR-6: 발송 모드 — 즉시 / 예약 */}
      <div className="block text-xs" role="radiogroup" aria-label="발송 모드">
        <span className="mb-1 block text-muted">발송 모드</span>
        <div className="flex w-full border border-line">
          <button
            type="button"
            aria-pressed={sendMode === "now"}
            onClick={() => setSendMode("now")}
            className={`flex-1 cursor-pointer border-none px-3 py-1.5 text-xs ${
              sendMode === "now"
                ? "bg-ink text-cream"
                : "bg-cream text-ink hover:bg-washi"
            }`}
          >
            지금 발송
          </button>
          <button
            type="button"
            aria-pressed={sendMode === "schedule"}
            onClick={() => setSendMode("schedule")}
            className={`flex-1 cursor-pointer border-none border-l border-line px-3 py-1.5 text-xs ${
              sendMode === "schedule"
                ? "bg-ink text-cream"
                : "bg-cream text-ink hover:bg-washi"
            }`}
          >
            예약 발송
          </button>
        </div>
      </div>

      {sendMode === "schedule" && (
        <label className="block text-xs">
          <span className="mb-1 block text-muted">예약 시각 (KST)</span>
          <input
            aria-label="예약 시각"
            type="datetime-local"
            value={scheduledAtInput}
            onChange={(e) => setScheduledAtInput(e.target.value)}
            required
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      )}

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
