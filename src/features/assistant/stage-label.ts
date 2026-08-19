/**
 * 지금 무엇을 하고 있는지 한 줄로 — **실제 도구 호출에서 나온다.**
 *
 * 예전에는 문구가 둘뿐이었고 둘 다 고정이었다("회사 PC로 보냈습니다…" →
 * "지식망 문서를 읽는 중…"). 진행과 무관하게 떠 있으니 오래 걸리면 멈춘 것처럼
 * 보였다. 폴러는 이미 `tool_use`를 실시간으로 받고 있으므로 그걸 문장으로 바꾼다.
 *
 * 돌아가는 문구를 지어내는 방법도 있지만 쓰지 않는다 — 안 하는 일을 한다고 쓰는
 * 셈이다. 멈춤 착시는 문구가 아니라 경과 시간 표시로 푼다.
 */

/** 대기열에 있고 아직 아무도 잡지 않은 상태. 이때는 도는 게 없다. */
export const STAGE_QUEUED = "에이전트를 부르는 중";
/** 폴러가 잡았고 에이전트가 막 돌기 시작한 상태 — 아직 도구는 안 불렀다. */
export const STAGE_START = "에이전트 실행 중";
/** 도구를 다 쓰고 답을 쓰는 중. */
export const STAGE_COMPOSING = "답을 정리하는 중";

/** 검색 도메인 → 사람이 아는 이름. 화면에 `handover`라고 뜨면 아무도 못 읽는다. */
const DOMAIN_KO: Record<string, string> = {
  knowledge_docs: "지식망",
  handover: "인수인계",
  handover_records: "인수인계",
  incidents: "사고",
  ai_tips: "AI TIP",
  backup_requests: "백업요청",
  contacts: "연락처",
  services: "서비스",
};

export type ToolCall = { name: string; input: Record<string, unknown> };

/** 볼트 경로에서 문서 이름만. 전체 경로는 길어서 한 줄에 안 들어간다. */
function docName(filePath: string): string {
  const base = filePath.split(/[/\\]/).pop() ?? "";
  return base.replace(/\.md$/i, "");
}

function domainsKo(input: Record<string, unknown>): string {
  const raw = input.domains;
  if (!Array.isArray(raw)) return "";
  const names = raw
    .map((d) => (typeof d === "string" ? (DOMAIN_KO[d] ?? "") : ""))
    .filter(Boolean);
  return [...new Set(names)].join("·");
}

export function stageLabel({ name, input }: ToolCall): string {
  if (name === "Read") {
    const path = typeof input.file_path === "string" ? input.file_path : "";
    const doc = path ? docName(path) : "";
    return doc ? `지식망 문서를 읽는 중 — ${doc}` : "지식망 문서를 읽는 중";
  }
  if (name === "Glob" || name === "Grep") {
    return "지식망을 훑는 중";
  }
  if (name === "mcp__ops__search_ops") {
    const ko = domainsKo(input);
    return ko ? `운영 기록을 찾는 중 — ${ko}` : "운영 기록을 찾는 중";
  }
  if (name === "mcp__ops__fetch_ops") {
    return "기록 전문을 읽는 중";
  }
  if (name === "mcp__ops__propose_doc") {
    return "지식망 초안을 쓰는 중";
  }
  if (name === "mcp__ops__report_gap") {
    return "빈틈을 남기는 중";
  }
  if (name === "mcp__ops__schedule_range") {
    return "일정을 조회하는 중";
  }
  // 도구가 늘어도 틀린 문장이 뜨면 안 된다. 아는 것만 말한다.
  return STAGE_START;
}

/**
 * 화면에 띄울 문구 — 서버가 준 단계가 있으면 그게 우선이다.
 *
 * 예전에는 `running`이 되면 무조건 "지식망 문서를 읽는 중"을 띄웠다. 읽고 있지
 * 않을 수도 있는 상태를 단정한 것이라 틀린 말이 될 수 있었다. 단계가 오기 전에는
 * **아는 사실만** 말한다 — 잡혔다(실행 중) 또는 아직 안 잡혔다(대기).
 */
export function pendingNoteFor(poll: {
  status?: string;
  stage?: string | null;
}): string {
  const stage = poll.stage?.trim();
  if (stage) return stage;
  if (poll.status === "running") return STAGE_START;
  return STAGE_QUEUED;
}

/**
 * 경과 시간 — 멈춤 착시를 푸는 건 문구가 아니라 이 숫자다.
 *
 * 단계가 한동안 안 바뀌어도(문서 하나를 오래 읽는 중) 이건 매초 움직이므로
 * 살아 있다는 게 드러난다. 보통 30~40초라 분 단위가 보이면 그 자체로 신호다.
 */
export function elapsedLabel(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}
