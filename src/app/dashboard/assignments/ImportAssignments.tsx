"use client";

import { useState } from "react";
import {
  importAssignments,
  type ImportAssignmentsResult,
} from "@/features/assignments/actions";
import { ModalShell } from "@/components/common/ModalShell";
import { HeaderActionButton } from "@/components/common/HeaderActionButton";

/**
 * 총괄장 시트 → 배정 원장 이관. **화면 교체(PR4) 전에 한 번 도는 버튼**이다
 * (설계 §10 사람 체크리스트 4: "시트 → DB 이관 1회 실행 + 대조 0건").
 *
 * ⚠️ **상시 재가져오기 버튼이 아니다.** 설계 R1 은 "DB를 덮어쓰는 버튼은 원장을
 * 파일에 종속시킨다" 며 재가져오기를 비범위로 뒀다. 자연키 upsert 로 멱등인 것은
 * 부분 실패 후 **재시도**를 위한 것이고, 이관이 끝나면 원천은 DB 다. 이 버튼을
 * PR4 에서 걷을지 남길지는 머지 때 정한다.
 *
 * 건수만 알리지 않는다 — 설계 §9.1 의 판정이 "대조 통과" 이고, 통과 못 했을 때
 * **어느 칸인지**가 곧 조치다. 이름을 못 맞춘 칸도 반드시 보여준다: 숫자만 주면
 * "다 됐다" 로 읽히는데 그 칸들은 담당자가 아무에게도 안 잡힌다
 * (`SyncAnnouncementOperators` 가 같은 것을 배웠다).
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

export function ImportAssignments({ academicYear }: { academicYear: number }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportAssignmentsResult | null>(null);

  const run = async () => {
    setPending(true);
    setResult(null);
    try {
      setResult(await importAssignments(academicYear));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <HeaderActionButton onClick={run} disabled={pending}>
        {pending ? "이관 중…" : "원장 이관"}
      </HeaderActionButton>

      {result && (
        <ModalShell
          title={`총괄장 → 원장 이관 (${academicYear}학년도)`}
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
              <p className="text-sm text-ink">
                칸{" "}
                <b className="tabular-nums">{result.rows.toLocaleString()}</b>
                개를 원장에 넣고 이력{" "}
                <b className="tabular-nums">
                  {result.history.toLocaleString()}
                </b>
                줄을 남겼습니다.
              </p>

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
                    화면을 원장으로 바꾸기 전에 0건이어야 합니다(설계 §9.1).
                  </p>
                  <CellList
                    title="시트에만 있는 칸 (이관 누락)"
                    keys={result.reconcile.missingInLedger}
                  />
                  <CellList
                    title="원장에만 있는 칸 (손으로 넣었거나 시트에서 지워짐)"
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

              {result.unresolvedNames.length > 0 && (
                <div className="border border-line-soft bg-situation-bg p-3">
                  <p className="text-xs font-medium text-ink">
                    이메일을 못 맞춘 이름{" "}
                    <span className="tabular-nums">
                      {result.unresolvedNames.length}
                    </span>
                    개
                  </p>
                  <p className="mt-1 text-2xs text-muted">
                    운영자 명단에 없거나 같은 이름이 둘 이상입니다. 이름은
                    원장에 남았지만 담당자로는 안 잡히고 이력도 남지 않습니다 —
                    운영자 이름을 시트와 맞춰 주세요.
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {result.unresolvedNames.map((n) => (
                      <li key={n} className="text-xs text-ink-soft">
                        {n}
                      </li>
                    ))}
                  </ul>
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
                    시트만으로는 가릴 수 없어 배정을 만들지 않은 자리입니다.
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
