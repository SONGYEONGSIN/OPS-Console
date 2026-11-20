"use client";

import { HeaderActionButton } from "@/components/common/HeaderActionButton";
import { COMMITTED_PREFIX, SAVE_WAITING, useSubmit } from "./use-submit";

function Notice({ message }: { message: string }) {
  const committed = message.startsWith(COMMITTED_PREFIX);
  return (
    <p
      role={committed ? "status" : "alert"}
      className={committed ? "text-ink-soft" : "text-vermilion"}
    >
      {message}
    </p>
  );
}

/**
 * 제출 한 곳 — 쓸 것 패널 맨 아래. 버튼은 canSubmit 일 때만이지만 대기·결과 문구는 남는다
 * (제출 뒤 새로고침으로 canSubmit=false 가 와도 '제출은 끝났지만…' 이 사라지면 안 된다).
 */
export function SubmitBar(props: {
  reportId: string | null;
  canSubmit: boolean;
}) {
  const submit = useSubmit(props.reportId);
  // 보일 것이 없으면 빈 구분선 상자를 남기지 않는다 — 컴포넌트는 마운트된 채라 useSubmit 상태는 산다.
  if (!props.canSubmit && !submit.waiting && submit.message === null) {
    return null;
  }
  return (
    <div className="flex flex-col items-stretch gap-2 border-t border-line pt-4">
      {props.canSubmit ? (
        <HeaderActionButton onClick={submit.submit} disabled={submit.pending}>
          제출완료
        </HeaderActionButton>
      ) : null}
      <div className="flex flex-col gap-1 text-xs">
        {submit.waiting ? (
          <p role="status" className="text-ink-soft">
            {SAVE_WAITING}
          </p>
        ) : null}
        {submit.message !== null ? <Notice message={submit.message} /> : null}
      </div>
    </div>
  );
}
