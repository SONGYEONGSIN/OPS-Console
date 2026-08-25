import {
  pendingNoteFor,
  STAGE_QUEUED,
  STAGE_STILL_QUEUED,
} from "./stage-label";

/**
 * 어시스턴트 큐를 답이 적힐 때까지 지켜본다.
 *
 * 실행은 회사 PC 폴러가 하므로 웹은 기다리는 수밖에 없다. 이 루프를 쓰는 곳이
 * 둘이다 — 어시스턴트 창과 지식망 '파일로 초안'. 두 벌로 두면 아래 판단들이
 * 한쪽에만 남는다.
 */

const POLL_MS = 2000;
/** 실측 30~45초. 3분이면 폴러가 물려 있는 것이다. */
const POLL_TIMEOUT_MS = 180_000;
/**
 * 이 시간 동안 pending에서 안 움직이면 아무도 claim하지 않은 것 = 회사 PC가 꺼졌다.
 * running으로 넘어갔다면 PC는 살아 있으니 이 판정을 하지 않는다.
 */
const UNCLAIMED_MS = 15_000;

type ClaudePoll = {
  ok: boolean;
  status?: string;
  /** 폴러가 알려준 지금 하는 일. 서버가 문장으로 만들어 준다. */
  stage?: string | null;
  answer?: string | null;
  sources?: string[];
  message?: string | null;
  error?: string;
};

export type PollOutcome =
  | { kind: "done"; answer: string; sources: string[] }
  | { kind: "failed"; message: string }
  | { kind: "timeout" };

/**
 * @param onStage 지금 무엇을 하는 중인지 — 화면에 그대로 띄운다.
 */
export async function pollAssistantRequest(
  id: string,
  onStage: (note: string) => void,
): Promise<PollOutcome> {
  onStage(STAGE_QUEUED);

  const startedAt = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const elapsed = Date.now() - startedAt;

    const res = await fetch(`/api/assistant/claude?id=${id}`);
    const json = (await res.json()) as ClaudePoll;

    // 폴러가 알려준 실제 단계를 그대로 보여준다. 아직 안 왔으면 아는 사실만 말한다
    // — 예전엔 claim만 되면 "문서를 읽는 중"이라 했는데 안 읽고 있을 수도 있었다.
    onStage(pendingNoteFor(json));

    if (json.status === "done") {
      return { kind: "done", answer: json.answer ?? "", sources: json.sources ?? [] };
    }
    if (json.status === "failed") {
      return { kind: "failed", message: json.message ?? "실행 실패" };
    }
    // 오래 안 가져가면 알린다 — 다만 **여기서 멈추지 않는다.**
    //
    // 예전엔 이 자리에서 "회사 PC가 꺼졌다"고 단정하고 폴링을 끝냈다. 그런데
    // claim 이 27초 걸린 요청이 있었고(Vercel 응답 지연으로 폴러 요청이 한 번
    // 끊기고 재시도), 그 뒤 도착한 343자짜리 답이 통째로 사라졌다(2026-08-19).
    //
    // 안 가져갔다는 건 사실이지만 **꺼진 건지 늦는 건지는 화면이 알 수 없다.**
    // 그러니 사실만 말하고 기다리는 건 계속한다. 끝내는 건 3분 제한 하나뿐이다.
    if (json.status === "pending" && elapsed > UNCLAIMED_MS) {
      onStage(STAGE_STILL_QUEUED);
    }
    if (elapsed > POLL_TIMEOUT_MS) {
      return { kind: "timeout" };
    }
  }
}
