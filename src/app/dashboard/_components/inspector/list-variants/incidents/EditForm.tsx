"use client";

import { useMemo, useState } from "react";
import type { EditFormProps } from "../types";
import { ListSearch } from "@/components/common/ListSearch";
import { DateInput } from "@/components/common/DateInput";

const APP_TYPE_OPTIONS = ["공통원서", "일반원서", "공공원서", "PIMS"] as const;
const STATUS_OPTIONS = ["미처리", "처리중", "처리완료", "보류"] as const;
const DEPARTMENT_OPTIONS = ["운영부-운영1팀", "운영부-운영2팀"] as const;

const REPORTER_BY_DEPARTMENT = {
  "운영부-운영1팀": "허승철",
  "운영부-운영2팀": "송영신",
} as const;

/** 학년도 selector 후보 — 현 학년도 기준 ±5년 */
function buildYearOptions(currentYear: number): number[] {
  const years: number[] = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) years.push(y);
  return years;
}

export function IncidentEditForm({
  row,
  setRow,
  onSave,
  onCancel,
  currentUserPermission = null,
  currentUserEmail = null,
  incidentUniversityNameSuggestions = [],
  incidentCategorySuggestions = [],
}: EditFormProps) {
  const isAdmin = currentUserPermission === "admin";
  const isOwnAssignee =
    !!currentUserEmail &&
    !!row.incidentAssigneeEmail &&
    row.incidentAssigneeEmail === currentUserEmail;
  const canDelete = isAdmin || isOwnAssignee;
  const currentYear = row.incidentYear ?? new Date().getFullYear();
  const yearOptions = useMemo(
    () => buildYearOptions(currentYear),
    [currentYear],
  );

  // 대학명 검색
  const [uniQuery, setUniQuery] = useState(row.incidentUniversityName ?? "");
  const trimmedUni = uniQuery.trim();
  const uniMatches = useMemo(() => {
    if (trimmedUni.length === 0) return [];
    return incidentUniversityNameSuggestions
      .filter((n) => n.includes(trimmedUni) && n !== trimmedUni)
      .slice(0, 10);
  }, [incidentUniversityNameSuggestions, trimmedUni]);

  function pickUniversity(name: string) {
    setUniQuery(name);
    setRow({ ...row, incidentUniversityName: name });
  }

  const department = row.incidentDepartment ?? "운영부-운영1팀";
  const reporterName = REPORTER_BY_DEPARTMENT[department];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">학년도</span>
        <select
          aria-label="학년도"
          value={row.incidentYear ?? currentYear}
          onChange={(e) =>
            setRow({ ...row, incidentYear: Number(e.target.value) })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}학년도
            </option>
          ))}
        </select>
      </label>

      <div className="block text-xs">
        <span className="mb-1 block text-muted">대학명</span>
        <ListSearch
          value={uniQuery}
          onChange={(v) => {
            setUniQuery(v);
            setRow({ ...row, incidentUniversityName: v });
          }}
          placeholder="대학명 검색"
          ariaLabel="대학명 검색"
          size="sm"
        />
        {uniMatches.length > 0 && (
          <ul
            aria-label="대학명 검색 결과"
            className="mt-1 max-h-40 overflow-y-auto border border-line-soft bg-washi-raised"
          >
            {uniMatches.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => pickUniversity(name)}
                  className="block w-full cursor-pointer border-none bg-transparent px-2 py-1 text-left text-2xs text-ink hover:bg-line-soft"
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">구분</span>
          <select
            aria-label="구분"
            value={row.incidentAppType ?? "공통원서"}
            onChange={(e) =>
              setRow({
                ...row,
                incidentAppType: e.target
                  .value as (typeof APP_TYPE_OPTIONS)[number],
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            {APP_TYPE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="mb-1 block text-muted">카테고리</span>
          <input
            aria-label="카테고리"
            list="incident-category-options"
            value={row.incidentCategory ?? ""}
            onChange={(e) =>
              setRow({ ...row, incidentCategory: e.target.value })
            }
            maxLength={50}
            placeholder="결제 / 원서작성 / 사이트 / 경쟁률 / 기타"
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
          <datalist id="incident-category-options">
            {incidentCategorySuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">발생일자</span>
          <DateInput
            aria-label="발생일자"
            value={row.incidentOccurredDate ?? ""}
            onChange={(e) =>
              setRow({
                ...row,
                incidentOccurredDate: e.target.value || null,
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>

        <label className="block text-xs">
          <span className="mb-1 block text-muted">처리일자</span>
          <DateInput
            aria-label="처리일자"
            value={row.incidentResolvedDate ?? ""}
            onChange={(e) =>
              setRow({
                ...row,
                incidentResolvedDate: e.target.value || null,
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      </div>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">사고제목</span>
        <input
          aria-label="사고제목"
          value={row.incidentTitle ?? ""}
          onChange={(e) => setRow({ ...row, incidentTitle: e.target.value })}
          maxLength={200}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="예: 결제 오류 / 발표 페이지 문구 오안내"
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">사고경위</span>
        <textarea
          aria-label="사고경위"
          value={row.incidentCauseSummary ?? ""}
          onChange={(e) =>
            setRow({
              ...row,
              incidentCauseSummary: e.target.value || null,
            })
          }
          rows={4}
          maxLength={5000}
          placeholder="사고 발생 과정 (Markdown 가능)"
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">사고원인</span>
        <textarea
          aria-label="사고원인"
          value={row.incidentRootCause ?? ""}
          onChange={(e) =>
            setRow({ ...row, incidentRootCause: e.target.value || null })
          }
          rows={3}
          maxLength={5000}
          placeholder="근본 원인"
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">사고처리</span>
        <textarea
          aria-label="사고처리"
          value={row.incidentResolution ?? ""}
          onChange={(e) =>
            setRow({ ...row, incidentResolution: e.target.value || null })
          }
          rows={3}
          maxLength={5000}
          placeholder="조치 내역"
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">사고대책</span>
        <textarea
          aria-label="사고대책"
          value={row.incidentPrevention ?? ""}
          onChange={(e) =>
            setRow({ ...row, incidentPrevention: e.target.value || null })
          }
          rows={3}
          maxLength={5000}
          placeholder="재발 방지 대책"
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">담당부서</span>
        <select
          aria-label="담당부서"
          value={department}
          onChange={(e) =>
            setRow({
              ...row,
              incidentDepartment: e.target
                .value as (typeof DEPARTMENT_OPTIONS)[number],
            })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          {DEPARTMENT_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div className="block text-xs">
          <span className="mb-1 block text-muted">담당자</span>
          <p className="border border-line-soft bg-washi-raised px-2 py-1 text-ink">
            {row.incidentAssigneeName ?? row.owner ?? "—"}
            <span className="ml-1 text-2xs text-muted">(본인 자동)</span>
          </p>
        </div>

        <div className="block text-xs">
          <span className="mb-1 block text-muted">보고자</span>
          <p className="border border-line-soft bg-washi-raised px-2 py-1 text-ink">
            {reporterName}
            <span className="ml-1 text-2xs text-muted">(부서 매핑)</span>
          </p>
        </div>
      </div>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">현재상황</span>
        <select
          aria-label="현재상황"
          value={row.incidentStatus ?? "미처리"}
          onChange={(e) =>
            setRow({
              ...row,
              incidentStatus: e.target.value as (typeof STATUS_OPTIONS)[number],
            })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          {STATUS_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
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
      {row.id !== "" && canDelete && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "이 사고보고를 삭제하시겠습니까? 메일 발송 이력도 함께 삭제되며 되돌릴 수 없습니다.",
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
