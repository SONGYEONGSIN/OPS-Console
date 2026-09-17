"use client";

import { useState } from "react";
import {
  reconcileAssignments,
  type ReconcileAssignmentsResult,
} from "@/features/assignments/actions";
import { ModalShell } from "@/components/common/ModalShell";
import { HeaderActionButton } from "@/components/common/HeaderActionButton";

/**
 * 총괄장 시트 ↔ 배정 원장 **대조**. 읽기만 하는 버튼이다.
 *
 * 여기 있던 이관(쓰기)은 걷었다(설계 §13 R1 · 사용자 결정 2026-09-15). 편집이 앱에서
 * 일어나는데 이관은 자연키 upsert 라 **시트에 있는 모든 칸을 시트 값으로 되돌리고**,
 * 그 덮어씀이 `assignment_changes` 에 정당한 변경으로 남아 사고로 구분되지 않는다.
 * 남긴 쪽은 **갈림을 만들지 않으면서 갈림을 탐지한다** — 시트를 방치하기로 해도
 * (열린 질문 3) 누가 고쳤다는 사실이 여기서 드러난다.
 *
 * 건수만 알리지 않는다 — 통과 못 했을 때 **어느 칸인지**가 곧 조치다.
 */
const MAX_LISTED = 50;

function CellList({ title, keys }: { title: string; keys: string[] }) {
  if (keys.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-ink">
        {title} <span className="tabular-nums">{keys.length}</span>건
      </p>
      <ul className="mt-1 space-y-0.5">
        {keys.slice(0, MAX_LISTED).map((k) => (
          <li key={k} className="text-2xs text-ink-soft">
            {k.split("|").join(" · ")}
          </li>
        ))}
      </ul>
      {keys.length > MAX_LISTED && (
        <p className="mt-1 text-2xs text-muted">
          …그리고{" "}
          <span className="tabular-nums">{keys.length - MAX_LISTED}</span>건 더
        </p>
      )}
    </div>
  );
}

export function ReconcileAssignments({
  academicYear,
}: {
  academicYear: number;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ReconcileAssignmentsResult | null>(null);

  const run = async () => {
    setPending(true);
    setResult(null);
    try {
      setResult(await reconcileAssignments(academicYear));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <HeaderActionButton onClick={run} disabled={pending}>
        {pending ? "대조 중…" : "원장 대조"}
      </HeaderActionButton>

      {result && (
        <ModalShell
          title={`총괄장 ↔ 원장 대조 (${academicYear}학년도)`}
          size="lg"
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
          {!result.ok ? (
            /* 실패 사유는 요약하지 않는다 — 왜 안 됐는지가 조치다. */
            <p className="text-xs text-vermilion">{result.error}</p>
          ) : (
            <div className="space-y-3">
              {/* 양쪽을 나란히 둔다. 한쪽 숫자만 보면 어디가 모자란지 모른다. */}
              <ul className="space-y-0.5 text-sm text-ink tabular-nums">
                <li>{`시트 ${result.reconcile.universities.sheet.toLocaleString()}곳 · ${result.reconcile.cells.sheet.toLocaleString()}칸`}</li>
                <li>{`원장 ${result.reconcile.universities.ledger.toLocaleString()}곳 · ${result.reconcile.cells.ledger.toLocaleString()}칸`}</li>
              </ul>

              {result.reconcile.mismatchCount === 0 ? (
                <p className="text-xs text-ink">
                  대조 통과 — 시트와 원장이 대학 수·칸 수·칸별 이름까지
                  같습니다.
                </p>
              ) : (
                <div className="space-y-2 border border-line-soft bg-situation-bg p-3">
                  <p className="text-xs font-medium text-vermilion">
                    대조 불일치{" "}
                    <span className="tabular-nums">
                      {result.reconcile.mismatchCount}
                    </span>
                    건
                  </p>
                  <p className="text-2xs text-muted">
                    원장이 원천입니다 — 시트를 원장에 맞추거나, 배정 화면에서
                    고치세요. 이 버튼은 원장을 바꾸지 않습니다.
                  </p>
                  <CellList
                    title="시트에만 있는 칸 (원장에 없음)"
                    keys={result.reconcile.missingInLedger}
                  />
                  <CellList
                    title="원장에만 있는 칸 (앱에서 넣었거나 시트에서 지워짐)"
                    keys={result.reconcile.extraInLedger}
                  />
                  {result.reconcile.nameMismatch.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-ink">
                        같은 칸 다른 이름{" "}
                        <span className="tabular-nums">
                          {result.reconcile.nameMismatch.length}
                        </span>
                        건
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {result.reconcile.nameMismatch
                          .slice(0, MAX_LISTED)
                          .map((m) => (
                            <li key={m.key} className="text-2xs text-ink-soft">
                              {m.key.split("|").join(" · ")} — 시트 {m.sheet} /
                              원장 {m.ledger}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {result.issues.length > 0 && (
                <div className="border border-line-soft bg-situation-bg p-3">
                  <p className="text-xs font-medium text-ink">
                    사람이 봐야 하는 것{" "}
                    <span className="tabular-nums">{result.issues.length}</span>
                    건
                  </p>
                  <p className="mt-1 text-2xs text-muted">
                    시트만으로는 가릴 수 없어 대조에서 한 칸으로 센 자리입니다.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {result.issues.map((i, idx) => (
                      <li key={`${i.university}-${idx}`} className="text-2xs">
                        <b className="text-ink">{i.university}</b>{" "}
                        <span className="text-ink-soft">{i.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </ModalShell>
      )}
    </>
  );
}
