import type { EditFormProps } from "../types";

function parseChips(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function BackupForm({ row, setRow, onSave, onCancel }: EditFormProps) {
  const servicesText = (row.backupServices ?? []).join(", ");
  const contactsText = (row.backupContacts ?? []).join(", ");

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

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">백업자 이메일</span>
          <input
            aria-label="백업자 이메일"
            type="email"
            value={row.substituteEmail ?? ""}
            onChange={(e) =>
              setRow({ ...row, substituteEmail: e.target.value })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
            placeholder="alice@example.com"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">백업자 이름</span>
          <input
            aria-label="백업자 이름"
            value={row.substituteName ?? ""}
            onChange={(e) => setRow({ ...row, substituteName: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
            placeholder="Alice"
          />
        </label>
      </div>

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
          <span className="mb-1 block text-muted">종료일</span>
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

      <label className="block text-xs">
        <span className="mb-1 block text-muted">담당 서비스 (쉼표 구분)</span>
        <input
          aria-label="담당 서비스"
          value={servicesText}
          onChange={(e) =>
            setRow({ ...row, backupServices: parseChips(e.target.value) })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="예: 입학사정관, 정시 추천"
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">대학 연락처 (쉼표 구분)</span>
        <input
          aria-label="대학 연락처"
          value={contactsText}
          onChange={(e) =>
            setRow({ ...row, backupContacts: parseChips(e.target.value) })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="예: 서울대 김OO, 연세대 이OO"
        />
      </label>

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
