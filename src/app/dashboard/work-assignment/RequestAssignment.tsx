"use client";

import { useState } from "react";
import { requestSingleProposal } from "@/features/assignments/proposal/actions";

/**
 * 단건 배정 요청 — **누른다고 배정되지 않는다.**
 *
 * 회사 PC 폴러에 판정을 시키고, 그 답은 제안 탭에서 관리자가 다시 승인한다. 문구를
 * `배정`이 아니라 `배정 요청`으로 두는 이유가 그것이다 — 누르고 나서 원장이 안 바뀐
 * 것을 보고 고장이라 읽으면 같은 버튼을 계속 누른다.
 *
 * 결과는 그 자리에 적는다. 적재가 성공해도 **판정은 몇 분 뒤에 끝나고**, 그 사이
 * 화면에 흔적이 없으면 사람은 안 눌렸다고 판단한다.
 */
export function RequestAssignment({
  academicYear,
  universityName,
  workKind,
}: {
  academicYear: number;
  universityName: string;
  workKind: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const run = async () => {
    setPending(true);
    setMessage(null);
    try {
      const r = await requestSingleProposal({
        academicYear,
        universityName,
        workKind,
      });
      // '이미 대기 중'(skipped)은 실패가 아니라 두 번 누른 것이다 — 붉게 적지 않는다.
      setFailed(!r.ok && !r.skipped);
      setMessage(r.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        className="cursor-pointer border border-line px-3 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending}
        onClick={run}
      >
        {pending ? "요청 중…" : "배정 요청"}
      </button>
      {message && (
        <span
          className={`text-xs ${failed ? "text-vermilion" : "text-ink-soft"}`}
        >
          {message}
        </span>
      )}
    </div>
  );
}
