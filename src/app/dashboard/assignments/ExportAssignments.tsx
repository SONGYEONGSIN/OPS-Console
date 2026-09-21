"use client";

import { useState } from "react";
import {
  runAssignmentExport,
  type AssignmentExportState,
} from "@/features/assignments/export-actions";
import { ModalShell } from "@/components/common/ModalShell";
import { HeaderActionButton } from "@/components/common/HeaderActionButton";

/**
 * 확정 원장 → 총괄장 `(앱) 배정확정` 시트.
 *
 * **한 번 더 묻는다.** 이 버튼은 사람이 보는 파일의 한 시트를 통째로 다시 쓴다 —
 * 대조(`ReconcileAssignments`)가 읽기만 하는 것과 다르다. 되돌리기는 파일 버전
 * 이력뿐이라, 누르기 전에 무엇이 일어나는지 읽을 자리를 둔다.
 *
 * 제안 탭의 `전체 적용` 이 한 번 더 묻고 `반려` 는 안 묻는 것과 같은 비대칭이다 —
 * 바꾸는 쪽만 묻는다.
 */
export function ExportAssignments() {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AssignmentExportState | null>(null);

  const run = async () => {
    setPending(true);
    try {
      setResult(await runAssignmentExport());
      setConfirming(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <HeaderActionButton
        onClick={() => {
          setResult(null);
          setConfirming(true);
        }}
      >
        시트 내보내기
      </HeaderActionButton>

      {confirming && (
        <ModalShell
          title="배정확정 시트 내보내기"
          onClose={() => setConfirming(false)}
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="cursor-pointer border border-line px-3 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
              >
                취소
              </button>
              <button
                type="button"
                onClick={run}
                disabled={pending}
                className="cursor-pointer border border-line px-3 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-default disabled:opacity-50"
              >
                {pending ? "내보내는 중…" : "내보내기"}
              </button>
            </div>
          }
        >
          <div className="space-y-2">
            <p className="text-xs text-ink">
              총괄장의 <b>(앱) 배정확정</b> 시트를 확정 원장으로 통째로 다시
              씁니다. 그 시트에 직접 적은 내용은 사라집니다.
            </p>
            <p className="text-2xs text-muted">
              사람이 쓰는 02~08 시트는 건드리지 않습니다. 파일에 반영되기까지
              1~2분 걸립니다.
            </p>
          </div>
        </ModalShell>
      )}

      {result && (
        <ModalShell
          title="내보내기 결과"
          onClose={() => setResult(null)}
          footer={
            <button
              type="button"
              onClick={() => setResult(null)}
              className="cursor-pointer border border-line px-3 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
            >
              닫기
            </button>
          }
        >
          {/* 실패 사유를 요약하지 않는다 — 왜 안 됐는지가 곧 조치다. */}
          <p
            className={`text-xs ${result.ok ? "text-ink" : "text-vermilion"}`}
          >
            {result.message}
          </p>
        </ModalShell>
      )}
    </>
  );
}
