/**
 * Graph 로 읽은 채팅 메시지에서 **명보를 부른 것만** 골라낸다.
 *
 * 봇 등록이 막혀 Graph 폴링으로 왔다(2026-08-27). 사람 계정이 읽는 구조라
 * `@멘션` 이 없으므로 **글자로 부른다**.
 *
 * 규칙을 좁게 둔다 — **이름으로 시작할 때만.** 방 한복판의 "명보가 답을 안 하네"
 * 같은 말에 끼어들면 대화를 망친다. 부를 때는 자연히 이름을 앞에 놓는다.
 */

/** 부르는 이름. 화면 안내와 어긋나지 않게 여기 한 곳에만 둔다. */
export const CALL_NAME = "명보";

/**
 * 부름말 — 이름(+호격) 뒤에 **공백이나 구두점이 와야** 한다.
 *
 * `명보가 답을 안 하네` 처럼 조사가 바로 붙으면 부른 게 아니라 **남 얘기**다.
 * 그걸 안 가르면 방 한복판에서 봇이 끼어든다.
 */
const CALL_HEAD = new RegExp(
  `^@?${CALL_NAME}(?:야|아|님)?(?=[\\s,.:!?~]|$)[\\s,.:!?~]*`,
);

export type GraphRead =
  | {
      ok: true;
      messageId: string;
      question: string;
      /** Entra 객체 id. **이메일이 아니다** — 명부 대조 전에 Graph 로 바꾼다. */
      aadObjectId: string;
      createdAt: string;
    }
  | { ok: false; reason: string };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

/** HTML 본문을 사람이 쓴 글로 되돌린다. 태그를 안 걷으면 질문에 마크업이 섞인다. */
function toText(html: string): string {
  return (
    html
      // 줄바꿈 태그는 공백으로 — 안 그러면 낱말이 붙는다.
      .replace(/<(br|\/p|\/div|\/li)[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function readGraphMessage(raw: unknown): GraphRead {
  const m = asRecord(raw);
  if (!m) return { ok: false, reason: "본문이 없습니다" };
  if (m.deletedDateTime) return { ok: false, reason: "삭제된 메시지" };

  const messageId = typeof m.id === "string" ? m.id : "";
  if (!messageId) return { ok: false, reason: "메시지 id 가 없습니다" };

  // 사람이 보낸 것만 받는다 — 앱·시스템 메시지에 답하면 봇끼리 대화하게 된다.
  const user = asRecord(asRecord(m.from)?.user);
  const aadObjectId = typeof user?.id === "string" ? user.id : "";
  if (!aadObjectId)
    return { ok: false, reason: "사람이 보낸 메시지가 아닙니다" };

  const content =
    typeof asRecord(m.body)?.content === "string"
      ? (asRecord(m.body)!.content as string)
      : "";
  const text = toText(content);
  if (!CALL_HEAD.test(text)) return { ok: false, reason: "부른 게 아닙니다" };

  const question = text.replace(CALL_HEAD, "").trim();
  if (!question) return { ok: false, reason: "질문이 비어 있습니다" };

  return {
    ok: true,
    messageId,
    question,
    aadObjectId,
    createdAt: typeof m.createdDateTime === "string" ? m.createdDateTime : "",
  };
}
