"use client";

import type { EditFormProps } from "../types";

const inputClass =
  "w-full border border-line bg-cream px-2 py-1 text-ink focus:border-vermilion focus:outline-none";

export function IncidentReportEditForm({
  row,
  setRow,
  onSave,
  onCancel,
}: EditFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">제목</span>
        <input
          aria-label="제목"
          value={row.incidentReportTitle ?? ""}
          onChange={(e) =>
            setRow({
              ...row,
              incidentReportTitle: e.target.value,
              name: e.target.value,
            })
          }
          maxLength={200}
          placeholder="예: 결제 오류 경위서"
          className={inputClass}
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">수신대학</span>
        <input
          aria-label="수신대학"
          value={row.incidentReportUniversity ?? ""}
          onChange={(e) =>
            setRow({ ...row, incidentReportUniversity: e.target.value })
          }
          maxLength={200}
          placeholder="수신 대학명"
          className={inputClass}
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">경위</span>
        <textarea
          aria-label="경위"
          value={row.incidentReportGyeongwi ?? ""}
          onChange={(e) =>
            setRow({ ...row, incidentReportGyeongwi: e.target.value || null })
          }
          rows={4}
          maxLength={5000}
          placeholder="사고 발생 경위 (Markdown 가능)"
          className={inputClass}
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">원인</span>
        <textarea
          aria-label="원인"
          value={row.incidentReportCause ?? ""}
          onChange={(e) =>
            setRow({ ...row, incidentReportCause: e.target.value || null })
          }
          rows={3}
          maxLength={5000}
          placeholder="근본 원인"
          className={inputClass}
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">처리</span>
        <textarea
          aria-label="처리"
          value={row.incidentReportHandling ?? ""}
          onChange={(e) =>
            setRow({ ...row, incidentReportHandling: e.target.value || null })
          }
          rows={3}
          maxLength={5000}
          placeholder="조치 내역"
          className={inputClass}
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">대책</span>
        <textarea
          aria-label="대책"
          value={row.incidentReportPrevention ?? ""}
          onChange={(e) =>
            setRow({ ...row, incidentReportPrevention: e.target.value || null })
          }
          rows={3}
          maxLength={5000}
          placeholder="재발 방지 대책"
          className={inputClass}
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">
          사과 본문{" "}
          <span className="text-[10px] text-muted">(미입력 시 기본 문구 자동)</span>
        </span>
        <textarea
          aria-label="사과 본문"
          value={row.incidentReportApology ?? ""}
          onChange={(e) =>
            setRow({ ...row, incidentReportApology: e.target.value || null })
          }
          rows={3}
          maxLength={5000}
          placeholder="사과 인사말"
          className={inputClass}
        />
      </label>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 cursor-pointer border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
    </form>
  );
}
