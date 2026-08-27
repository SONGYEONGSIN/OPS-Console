import { readGraphMessage, type GraphRead } from "./graph-message";

/**
 * 방에서 읽은 메시지 중 **처리할 것만** 고르고, 다음에 어디서부터 볼지 정한다.
 *
 * 커서를 잘못 옮기면 두 가지 사고가 난다 — 뒤로 가면 같은 질문에 또 답하고,
 * 앞으로 가면 그 사이 질문이 통째로 사라진다. 그래서 순수 함수로 떼어 시험한다.
 */

type Called = Extract<GraphRead, { ok: true }>;

function timeOf(m: unknown): number {
  const t = (m as { createdDateTime?: unknown })?.createdDateTime;
  const ms = typeof t === "string" ? Date.parse(t) : NaN;
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * 커서 이후에 온 **부름**만, 물어본 순서대로.
 *
 * 커서가 없으면(처음 보는 방) 아무것도 처리하지 않는다 — 그 방의 옛 대화에
 * 뒤늦게 답하기 시작하면 방이 어지러워진다. 커서만 '지금'으로 세워 둔다.
 */
export function pickNewMessages(rows: unknown[], cursorIso: string | null): Called[] {
  if (!cursorIso) return [];
  const cursor = Date.parse(cursorIso);
  if (!Number.isFinite(cursor)) return [];

  return rows
    .filter((m) => {
      const ms = timeOf(m);
      return Number.isFinite(ms) && ms > cursor;
    })
    // Graph 는 최신순으로 준다. 물어본 순서대로 답해야 대화가 맞물린다.
    .sort((a, b) => timeOf(a) - timeOf(b))
    .map(readGraphMessage)
    .filter((r): r is Called => r.ok);
}

/**
 * 다음 커서 — **본 것 중 가장 나중 시각.**
 *
 * 부름이 아니어도 본 것은 본 것이다. 잡담을 커서에서 빼면 그 뒤 폴링이 매번
 * 같은 잡담을 다시 읽는다.
 *
 * 뒤로는 가지 않는다. 되돌아가면 이미 답한 질문에 또 답한다.
 */
export function nextCursor(rows: unknown[], cursorIso: string): string {
  const base = Date.parse(cursorIso);
  let latest = Number.isFinite(base) ? base : 0;
  let latestIso = cursorIso;
  for (const m of rows) {
    const ms = timeOf(m);
    if (Number.isFinite(ms) && ms > latest) {
      latest = ms;
      latestIso = (m as { createdDateTime: string }).createdDateTime;
    }
  }
  return latestIso;
}
