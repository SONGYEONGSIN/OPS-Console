"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createRoundAction } from "@/features/checklist/actions";
import { ModalShell } from "@/components/common/ModalShell";

type Props = {
  rounds: { id: string; title: string }[];
  onClose: () => void;
};

type ActionResult = Awaited<ReturnType<typeof createRoundAction>>;

/**
 * 새 회차 생성 모달 — ModalShell 표준 셸(NewReportModal 골격) + useActionState(createRoundAction).
 * seed 라디오(template/clone/empty) — clone 선택 시 아래 select에서 원본 회차 지정.
 */
export function NewRoundModal({ rounds, onClose }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    ActionResult | null,
    FormData
  >(async (prev, formData) => {
    const result = await createRoundAction(prev, formData);
    if (result.ok && result.id) {
      onClose();
      router.push(`/dashboard/checklist/${result.id}`);
    }
    return result;
  }, null);

  return (
    <ModalShell
      title="새 모집시기 생성"
      ariaLabel="새 모집시기"
      onClose={onClose}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
          >
            취소
          </button>
          <button
            type="submit"
            form="new-round-form"
            disabled={pending}
            className="cursor-pointer border border-ink bg-ink px-4 py-1.5 text-sm font-medium text-cream transition-colors hover:bg-vermilion disabled:cursor-not-allowed disabled:text-cream/70"
          >
            {pending ? "생성 중…" : "만들기"}
          </button>
        </>
      }
    >
      <form id="new-round-form" action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted">제목</span>
          <input
            name="title"
            required
            placeholder="2027학년도 수시모집"
            className="border border-line-soft bg-field-bg px-3 py-2 text-sm text-ink focus:border-ink focus:bg-white"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted">점검 시작</span>
            <input
              name="periodStart"
              type="date"
              className="border border-line-soft bg-field-bg px-2 py-1.5 text-sm text-ink focus:border-ink focus:bg-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted">점검 종료</span>
            <input
              name="periodEnd"
              type="date"
              className="border border-line-soft bg-field-bg px-2 py-1.5 text-sm text-ink focus:border-ink focus:bg-white"
            />
          </label>
        </div>

        <fieldset className="text-sm">
          <legend className="mb-1 text-xs text-muted">시작 방식</legend>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="seed" value="template" defaultChecked />
              기본 템플릿
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="seed" value="clone" />
              이전 모집시기 복제
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="seed" value="empty" />빈 모집시기
            </label>
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted">
            복제할 모집시기 (이전 모집시기 복제 선택 시)
          </span>
          <select
            name="cloneFromRoundId"
            className="border border-line-soft bg-field-bg px-2 py-1.5 text-sm text-ink focus:border-ink focus:bg-white"
          >
            <option value="">복제할 모집시기 선택</option>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>

        {state && !state.ok && "error" in state ? (
          <p className="text-xs text-vermilion">{state.error}</p>
        ) : null}
      </form>
    </ModalShell>
  );
}
