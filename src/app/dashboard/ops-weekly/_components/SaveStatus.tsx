import { formatHm } from "../_format";

/**
 * 자동 저장 상태 — 제목 줄 오른쪽에 둔다. 칸을 떠나면 저장된다는 것을 처음 보는 사람도 알게 하고,
 * 실패는 색으로도 말한다(상세 문구는 필드 아래 alert).
 */
export function SaveStatus(props: {
  pending: boolean;
  error: string | null;
  savedAt: string | null;
}) {
  const { pending, error, savedAt } = props;
  const failed = !pending && error !== null;
  const text = pending
    ? "저장 중…"
    : failed
      ? "저장 안 됨"
      : savedAt !== null
        ? `저장됨 ${formatHm(savedAt)}`
        : "자동 저장";
  return (
    <span
      aria-live="polite"
      className={`text-xs tabular-nums ${failed ? "text-vermilion" : "text-muted"}`}
    >
      {text}
    </span>
  );
}
