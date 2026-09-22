"use client";

import { useState } from "react";
import {
  importAssignments,
  type ImportAssignmentsResult,
} from "@/features/assignments/actions";
import { HEADER_ACTION_CLASS } from "@/components/common/HeaderActionButton";

/**
 * 총괄장 → 원장 **적재**. 그 학년도에 **없는 칸만** 만든다.
 *
 * 설계 §13 R1 은 재가져오기를 만들지 않기로 했다(사용자 결정 2026-09-15) — 자연키
 * upsert 가 앱에서 고친 배정을 시트 값으로 되돌리고, 그 덮어씀이 정당한 변경으로
 * 이력에 남아 사고로 구분되지 않기 때문이다. 이 버튼은 그것이 아니고, **그럴 수
 * 없다**: action 이 `ON CONFLICT DO NOTHING` 으로 넣어 이미 있는 칸은 DB 가 안 받는다.
 *
 * 그래서 화면이 **넣은 것과 건드리지 않은 것을 따로** 보여준다. 합만 보여주면 두 번째
 * 실행이 성공인지 아무 일도 안 한 것인지 구분되지 않고, 사람은 덮였는지를 의심한다.
 */
export function ImportLedgerYear({ academicYear }: { academicYear: number }) {
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
    <div className="space-y-2">
      {/*
       * **액션 버튼은 모양이 하나뿐이다.** 클래스 문자열을 새로 적는 순간 그게 두
       * 번째 표준이 되고, 같은 일을 하는 버튼이 화면마다 달라 보인다(#1047·#1049).
       * 컴포넌트가 아니라 클래스를 쓰는 것은 `pending` 라벨을 직접 갈기 때문이다.
       */}
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={HEADER_ACTION_CLASS}
      >
        {pending ? "적재 중…" : `총괄장에서 ${academicYear}학년도 적재`}
      </button>

      {result &&
        (!result.ok ? (
          /* 실패 사유는 요약하지 않는다 — 왜 안 됐는지가 곧 조치다. */
          <p className="text-xs text-vermilion">{result.error}</p>
        ) : (
          <div className="space-y-1 text-2xs text-ink-soft">
            <p className="text-xs text-ink tabular-nums">
              새로 넣음 {result.inserted.toLocaleString()}칸 · 이미 있어
              건드리지 않음 {result.skipped.toLocaleString()}칸
            </p>
            {result.inserted > result.linked && (
              /*
               * 이름만 들어간 칸은 **화면에서 부하로 세어지지 않는다** — 배분현황이
               * 운영자를 이메일로 묶기 때문이다. 합만 보여주면 그게 안 보인다.
               */
              <p className="tabular-nums">
                담당자 연결 {result.linked.toLocaleString()}칸 · 이름만{" "}
                {(result.inserted - result.linked).toLocaleString()}칸 —
                이름만인 칸은 배정현황에서 그 사람 몫으로 세어지지 않습니다.
              </p>
            )}
            {result.ambiguousNames.length > 0 && (
              <p>
                동명이인이라 잇지 못한 이름:{" "}
                <b className="text-ink">{result.ambiguousNames.join(" · ")}</b>{" "}
                — 총괄장 화면에서 사람을 골라 주세요.
              </p>
            )}
            {result.issues.length > 0 && (
              <ul className="space-y-0.5">
                {result.issues.map((i, idx) => (
                  <li key={`${i.university}-${idx}`}>
                    <b className="text-ink">{i.university}</b> {i.detail}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted">
              이미 원장에 있는 칸은 덮어쓰지 않습니다 — 앱에서 고친 배정은
              그대로 남고, 다시 눌러도 안전합니다.
            </p>
          </div>
        ))}
    </div>
  );
}
