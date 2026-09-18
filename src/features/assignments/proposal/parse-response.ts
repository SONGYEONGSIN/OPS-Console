import { z } from "zod";
import { workKey } from "../workload";
import type { ProposedMove } from "./objective";

/**
 * 에이전트 응답 읽기 — **믿지 않고 읽는다**(§6.3).
 *
 * **던지지 않는다.** 폴러가 `failed` 로 회신해야 하는데 여기서 던지면 그 경로가
 * 예외로 끊기고 관리자 화면에 '판정 중' 이 영원히 남는다.
 *
 * 모르는 대학을 여기서 떨구는 이유는 그것이 제약 위반이 아니라 **환각**이기
 * 때문이다(§6.1) — 후보 목록에 없는 대학은 애초에 옮길 수 있는 것이 아니었다.
 */

export type ParseProposalResult =
  { ok: true; moves: ProposedMove[] } | { ok: false; error: string };

/**
 * 하위유형·역할이 섞여 와도 받는다(`work_kind` 아래로 흘려보낸다) — §6.3 의 응답
 * 형식에는 있지만 **이동의 단위가 아니다**(`objective.ts` 의 `ProposedMove`).
 */
const moveSchema = z.object({
  university_name: z.string().trim().min(1),
  work_kind: z.string().trim().min(1),
  prev_assignee: z.string().trim().nullable(),
  next_assignee: z.string().trim().min(1),
  // 공백뿐인 근거는 **빈 문자열로 통과시킨다** — 떨구는 것은 G7 이다. 여기서 막으면
  // '근거를 안 썼다' 가 보고에 안 남고 응답 전체가 실패로 보인다.
  reason: z.string(),
});

const responseSchema = z.object({ moves: z.array(moveSchema) });

/**
 * 코드펜스를 벗긴다. **폴백이 아니라 경로의 모양이다** — `claude -p` 가 JSON 을
 * ```json 으로 감싸 주는 일이 흔하고, 못 벗기면 판정이 통째로 죽는다.
 */
const unfence = (raw: string) => {
  const t = raw.trim();
  if (!t.startsWith("```")) return t;
  return t
    .replace(/^```[a-zA-Z]*\s*/, "")
    .replace(/```$/, "")
    .trim();
};

export function parseProposalResponse(
  raw: string,
  candidates: readonly { university_name: string; work_kind: string }[],
): ParseProposalResult {
  let json: unknown;
  try {
    json = JSON.parse(unfence(raw));
  } catch {
    return { ok: false, error: "응답이 JSON 이 아닙니다" };
  }

  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `응답 형식이 맞지 않습니다: ${issue.path.join(".") || "(최상위)"} — ${issue.message}`,
    };
  }

  const allowed = new Set(candidates.map(workKey));
  const byKey = new Map<string, ProposedMove>();

  for (const m of parsed.data.moves) {
    const key = workKey(m);
    if (!allowed.has(key)) {
      return {
        ok: false,
        error: `옮길 수 있는 후보가 아닙니다: ${m.university_name} ${m.work_kind}`,
      };
    }

    const move: ProposedMove = { ...m, reason: m.reason.trim() };
    const seen = byKey.get(key);
    // 하위유형마다 한 줄씩 올 수 있다. 같은 답이면 합치고, **다른 답이면 그게 분할**이라
    // 거부한다 — 수시는 김, 정시는 이가 되는 것이 C4 가 막으려던 것이다.
    if (seen && seen.next_assignee !== move.next_assignee) {
      return {
        ok: false,
        error: `한 칸에 서로 다른 담당자를 제안했습니다: ${m.university_name} ${m.work_kind}`,
      };
    }
    if (!seen) byKey.set(key, move);
  }

  return { ok: true, moves: [...byKey.values()] };
}
