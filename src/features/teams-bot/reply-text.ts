/**
 * 큐의 한 건을 채팅에 쓸 한 덩이 글로 만든다.
 *
 * 답이 아직 없을 수도, 실패했을 수도, 회사 PC 가 꺼져 있을 수도 있다. **어느 경우든
 * "찾아보는 중…"이 영영 남아 있으면 안 된다** — 그건 사람이 계속 기다리게 만든다.
 *
 * `null` 은 "아직 고쳐 쓸 것이 없다" 는 뜻이다(정상적으로 도는 중).
 */

/** Teams 메시지 상한. 넘기면 잘리는데, 말없이 끊기면 답이 그런 줄 안다. */
export const TEAMS_TEXT_LIMIT = 3800;

/** 이보다 오래 조용하면 회사 PC 를 의심한다. 실측 6~40초라 3분이면 충분히 길다. */
const STALE_MS = 3 * 60_000;

const TRUNCATED = "\n\n… (길어서 잘렸습니다. 전체는 웹 어시스턴트에서 보세요)";

export type QueueRow = {
  status: string;
  answer?: string | null;
  message?: string | null;
  requested_at: string;
};

export function replyTextFor(row: QueueRow): string | null {
  const answer = (row.answer ?? "").trim();

  if (row.status === "done") {
    // done 인데 답이 비었다 — 빈 메시지로 고쳐 쓰면 무슨 일인지 알 수 없다.
    if (!answer) return "답을 받지 못했습니다. 다시 불러주세요.";
    if (answer.length <= TEAMS_TEXT_LIMIT) return answer;
    return answer.slice(0, TEAMS_TEXT_LIMIT - TRUNCATED.length) + TRUNCATED;
  }

  if (row.status === "failed") {
    const why = (row.message ?? "").trim();
    return why ? `답하지 못했습니다 — ${why}` : "답하지 못했습니다. 다시 불러주세요.";
  }

  // 아직 도는 중. 다만 너무 오래면 사실대로 알린다 — 회사 PC 가 꺼져 있을 수 있다.
  const waited = Date.now() - Date.parse(row.requested_at);
  if (Number.isFinite(waited) && waited > STALE_MS) {
    return "아직 응답이 없습니다. 회사 PC 에이전트가 멈춰 있을 수 있어요 — 잠시 뒤 다시 불러주세요.";
  }
  return null;
}
