/**
 * Teams Activity 에서 **물어본 사람과 물어본 것**만 꺼낸다.
 *
 * 채팅방에서 부르면 본문에 멘션이 통째로 섞여 온다(`<at>명보</at> 질문`). 그대로
 * 큐에 넣으면 에이전트가 제 이름을 질문의 일부로 읽는다.
 *
 * 순수 함수로 두는 이유: 라우트 안에 묻으면 이상한 모양이 왔을 때를 테스트할 수 없다.
 * 채팅방에는 온갖 것이 흘러다니므로 **모르는 모양이면 던지지 말고 거절**한다.
 */

/** 질문 상한 — 창구(`/api/assistant/bot`)의 zod 스키마와 같은 값이어야 한다. */
export const MAX_QUESTION = 4000;

export type ReadResult =
  | {
      ok: true;
      question: string;
      /** Entra 객체 id. **이메일이 아니다** — 명부 대조 전에 Graph 로 바꿔야 한다. */
      aadObjectId: string;
      conversationId: string;
      /** 테넌트·지역마다 다르다. 고정값으로 박으면 다른 지역에서 깨진다. */
      serviceUrl: string;
    }
  | { ok: false; reason: string };

type Mention = { type?: string; text?: string; mentioned?: { id?: string } };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

export function readActivity(raw: unknown, botId: string): ReadResult {
  const a = asRecord(raw);
  if (!a) return { ok: false, reason: "본문이 없습니다" };
  // 들어오고 나가는 알림(conversationUpdate) 등에는 답하지 않는다.
  if (a.type !== "message") return { ok: false, reason: `대상이 아닌 활동: ${String(a.type)}` };

  const from = asRecord(a.from);
  const conversation = asRecord(a.conversation);
  const serviceUrl = typeof a.serviceUrl === "string" ? a.serviceUrl : "";
  const conversationId = typeof conversation?.id === "string" ? conversation.id : "";
  if (!serviceUrl || !conversationId) {
    return { ok: false, reason: "어디로 답할지 알 수 없습니다" };
  }

  // 이름이 아니라 디렉터리 id 로 사람을 가른다 — 이름은 겹칠 수 있다.
  const aadObjectId = typeof from?.aadObjectId === "string" ? from.aadObjectId : "";
  if (!aadObjectId) return { ok: false, reason: "누가 물었는지 알 수 없습니다" };

  const entities = Array.isArray(a.entities) ? (a.entities as Mention[]) : [];
  const mentions = entities.filter((e) => e?.type === "mention");

  // **개인 채팅에는 멘션이 없다** — 1:1 에서는 부를 이름이 없으니 그냥 말한다.
  // 여기서 멘션을 요구했더니 개인 채팅의 모든 말이 조용히 거절됐다(2026-08-26).
  const conversationType =
    typeof conversation?.conversationType === "string" ? conversation.conversationType : "";
  const isPersonal = conversationType === "personal";

  // 멘션 id 는 `28:{App ID}` 로 온다 — App ID 와 직접 비교하면 영영 안 맞는다.
  const calledMe = mentions.some((m) => {
    const id = m.mentioned?.id ?? "";
    return id === botId || id.endsWith(`:${botId}`);
  });

  // 여럿이 보는 자리에서는 불렀을 때만 답한다 — 모든 말에 끼어들지 않는다.
  if (!isPersonal && !calledMe) {
    return { ok: false, reason: "나를 부르지 않았습니다" };
  }

  // 멘션 조각을 통째로 들어낸다. 내 것뿐 아니라 남의 멘션도 질문이 아니다.
  let text = typeof a.text === "string" ? a.text : "";
  for (const m of mentions) {
    if (m.text) text = text.split(m.text).join(" ");
  }
  const question = text.replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION);
  if (!question) return { ok: false, reason: "질문이 비어 있습니다" };

  return { ok: true, question, aadObjectId, conversationId, serviceUrl };
}
