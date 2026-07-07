"use client";

import type { EditFormProps } from "../types";
import { STEP_LABEL, type Step } from "@/features/performance/schemas";
import { OPERATORS } from "@/features/auth/operators";
import { PerformanceStepper } from "./Stepper";

const TEAM_MEMBERS = OPERATORS.filter((o) => !o.name.startsWith("테스트"));

/**
 * performance EditForm — 표준 인스펙터 폼.
 * - 신규(+ 새 사이클): 팀원 선택 + 사이클명 → onSave(row) → cycle+assignment 생성.
 * - 기존: 진행 요약 + 상세/리포트 페이지 링크 (목표·지표·루브릭 편집은 상세 페이지).
 */
export function PerformanceEditForm({
  row,
  setRow,
  onSave,
  onCancel,
}: EditFormProps) {
  const isNew = !row.id;

  if (!isNew) {
    const step = (row.performanceCurrentStep ?? 1) as Step;
    return (
      <div className="space-y-4">
        <PerformanceStepper currentStep={step} />
        <div className="border border-line-soft bg-washi p-3 text-xs text-muted">
          현재 단계: <span className="font-bold text-ink">
            {step}. {STEP_LABEL[step]}
          </span>
          . 목표·성과지표·관리자평가 작성은 상세 페이지에서 진행합니다.
        </div>
        <a
          href={`/dashboard/outcomes/${row.id}`}
          className="block border border-line bg-ink px-3 py-1.5 text-center text-sm font-medium text-cream hover:bg-ink/90"
        >
          상세 페이지에서 작업
        </a>
        <a
          href={`/dashboard/outcomes/${row.id}/print`}
          target="_blank"
          rel="noreferrer"
          className="block border border-line bg-transparent px-3 py-1.5 text-center text-sm text-ink hover:bg-washi"
        >
          리포트 미리보기
        </a>
        <button
          type="button"
          onClick={onCancel}
          className="w-full border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          닫기
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
    >
      <p className="text-xs font-medium text-muted">
        새 사이클 — 팀원과 사이클명을 지정하면 목표설정(1단계)부터 시작합니다.
      </p>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">팀원</span>
        <select
          aria-label="팀원"
          value={row.performanceEvaluateeEmail ?? ""}
          onChange={(e) => {
            const email = e.target.value;
            const op = TEAM_MEMBERS.find((o) => o.email === email);
            setRow({
              ...row,
              performanceEvaluateeEmail: email,
              performanceEvaluateeName: op?.name ?? "",
              owner: op?.name ?? "",
            });
          }}
          className="w-full border border-line bg-cream px-2 py-1 text-ink focus:border-ink focus:bg-white"
          required
        >
          <option value="">선택…</option>
          {TEAM_MEMBERS.map((o) => (
            <option key={o.email} value={o.email}>
              {o.name} ({o.team})
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">사이클명</span>
        <input
          aria-label="사이클명"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          placeholder="예: 2026 상반기"
          className="w-full border border-line bg-cream px-2 py-1 text-ink focus:border-ink focus:bg-white"
          required
        />
      </label>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 border border-line bg-vermilion px-3 py-1.5 text-sm font-medium text-cream hover:bg-vermilion-deep"
        >
          사이클 생성
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
