"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  row: ListRow;
  setRow: Dispatch<SetStateAction<ListRow>>;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
};

function isoToDate(iso?: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function dateToIso(date: string): string | null {
  if (!date) return null;
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}

export function ServicesForm({ row, setRow, onSave, onCancel }: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">service_id</span>
        <input
          type="number"
          aria-label="service_id"
          value={row.serviceIdNum ?? ""}
          onChange={(e) =>
            setRow({
              ...row,
              serviceIdNum: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          className="w-full border border-line bg-cream px-2 py-1 font-mono text-ink"
          placeholder="외부 PIMS 7자리 (자체 생성도 입력)"
          required
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">대학명</span>
          <input
            aria-label="대학명"
            value={row.universityName ?? ""}
            onChange={(e) =>
              setRow({ ...row, universityName: e.target.value })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
            required
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">서비스명</span>
          <input
            aria-label="서비스명"
            value={row.serviceName ?? ""}
            onChange={(e) => setRow({ ...row, serviceName: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
            required
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">접수구분</span>
          <input
            aria-label="접수구분"
            value={row.applicationType ?? ""}
            onChange={(e) =>
              setRow({ ...row, applicationType: e.target.value })
            }
            placeholder="공통원서 / 반응형원서 / ..."
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">지역</span>
          <input
            aria-label="지역"
            value={row.region ?? ""}
            onChange={(e) => setRow({ ...row, region: e.target.value })}
            placeholder="서울 / 경기 / ..."
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">대학구분</span>
          <input
            aria-label="대학구분"
            value={row.universityType ?? ""}
            onChange={(e) =>
              setRow({ ...row, universityType: e.target.value })
            }
            placeholder="4년제 / 2년제 / ..."
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">카테고리</span>
          <input
            aria-label="카테고리"
            value={row.category ?? ""}
            onChange={(e) => setRow({ ...row, category: e.target.value })}
            placeholder="수시 / 정시 / ..."
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">운영자 이메일</span>
          <input
            type="email"
            aria-label="운영자 이메일"
            value={row.operatorEmail ?? ""}
            onChange={(e) =>
              setRow({
                ...row,
                operatorEmail: e.target.value || null,
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">개발자 이메일</span>
          <input
            type="email"
            aria-label="개발자 이메일"
            value={row.developerEmail ?? ""}
            onChange={(e) =>
              setRow({
                ...row,
                developerEmail: e.target.value || null,
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">작성시작</span>
          <input
            type="date"
            aria-label="작성시작"
            value={isoToDate(row.writeStartAt)}
            onChange={(e) =>
              setRow({ ...row, writeStartAt: dateToIso(e.target.value) })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">작성마감</span>
          <input
            type="date"
            aria-label="작성마감"
            value={isoToDate(row.writeEndAt)}
            onChange={(e) =>
              setRow({ ...row, writeEndAt: dateToIso(e.target.value) })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">결제시작</span>
          <input
            type="date"
            aria-label="결제시작"
            value={isoToDate(row.payStartAt)}
            onChange={(e) =>
              setRow({ ...row, payStartAt: dateToIso(e.target.value) })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">결제마감</span>
          <input
            type="date"
            aria-label="결제마감"
            value={isoToDate(row.payEndAt)}
            onChange={(e) =>
              setRow({ ...row, payEndAt: dateToIso(e.target.value) })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink">
        <input
          type="checkbox"
          aria-label="단독여부"
          checked={row.solo ?? false}
          onChange={(e) => setRow({ ...row, solo: e.target.checked })}
        />
        단독여부
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
      {row.id !== "" && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "이 서비스를 삭제하시겠습니까? 되돌릴 수 없습니다.",
                )
              ) {
                onSave({ ...row, status: "deleted" });
              }
            }}
            className="w-full border border-vermilion-deep bg-transparent px-3 py-1.5 text-sm text-vermilion-deep hover:bg-vermilion-deep hover:text-cream"
          >
            삭제
          </button>
        </div>
      )}
    </form>
  );
}
