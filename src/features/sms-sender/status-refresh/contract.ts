import { z } from "zod";

/**
 * 현황 최신화 결과 계약 — 회사 PC(Python)가 보내는 본문과, 그것을 사람이 읽는 말로 바꾸는 규칙.
 *
 * 클라이언트(이력 모달)에서도 import 하므로 `server-only` 를 붙이지 않는다.
 *
 * **모르는 단계·코드도 받는다.** 새 폴러가 서버보다 먼저 배포돼 처음 보는 코드를 보내도
 * 400 으로 버리지 않는다 — 버리면 running 이 40분 동안 큐를 막고 결과가 사라진다.
 * 모르는 것은 그대로 저장하고 일반 문구로 보인다.
 */

export const STEP_LABEL: Record<string, string> = {
  moa: "Moa 수집",
  pims: "PIMS 수집",
  workbook: "현황 파일",
};

export function stepLabel(id: string): string {
  return STEP_LABEL[id] ?? id;
}

/** 실패 코드 → 사람이 할 일. Python 은 코드만 보내고 문구는 여기 한 곳에서 정한다. */
export const FAILURE_COPY: Record<string, string> = {
  lease_busy:
    "다른 Moa 자동화(마감 스크랩·경쟁률 점검)가 로그인 중이라 Moa 수집을 건너뛰었습니다. 몇 분 뒤 다시 누르세요.",
  login_failed:
    "Moa 로그인에 실패했습니다(인증 문자 또는 비밀번호). 관리자에게 알려 주세요.",
  moa_empty:
    "Moa 발신번호 화면이 비어 있어 저장하지 않았습니다. 잠시 뒤 다시 누르세요.",
  moa_shape_changed:
    "Moa 발신번호 화면의 열이 바뀌어 저장하지 않았습니다. 관리자에게 알려 주세요.",
  moa_incomplete:
    "Moa 발신번호 목록을 끝까지 읽지 못했거나 지난번보다 절반 넘게 줄어 저장하지 않았습니다. 잠시 뒤 다시 누르고, 또 그러면 관리자에게 알려 주세요.",
  pims_login_failed:
    "PIMS 모니터링 로그인에 실패했습니다(아이디·비밀번호는 Moa 와 같습니다). 관리자에게 알려 주세요.",
  pims_empty:
    "PIMS SMS 번호관리 화면이 비어 있어 저장하지 않았습니다. 잠시 뒤 다시 누르세요.",
  pims_shape_changed:
    "PIMS SMS 번호관리 화면의 열이 바뀌어 저장하지 않았습니다. 관리자에게 알려 주세요.",
  pims_incomplete:
    "PIMS 발신번호 목록을 끝까지 읽지 못했거나(처리상태 전체 조회 실패 포함) 지난번보다 절반 넘게 줄어 저장하지 않았습니다. 잠시 뒤 다시 누르고, 또 그러면 관리자에게 알려 주세요.",
  source_missing:
    "Teams 에서 현황 파일이나 세종·Moa·PIMS 등록 리스트를 찾지 못했습니다. 폴더를 확인하세요.",
  source_shape:
    "Teams 의 등록 리스트 파일 머리글이 예상과 다릅니다. 관리자에게 알려 주세요.",
  excel_failed:
    "회사 PC 의 Excel 작업이 실패했습니다. 현황 파일은 그대로입니다. 관리자에게 알려 주세요.",
  verify_failed:
    "검사에서 어긋난 곳이 있어 올리지 않았습니다. 현황 파일은 그대로입니다. 관리자에게 알려 주세요.",
  changed:
    "그 사이 누가 현황 파일을 저장했습니다. 다시 누르면 새 파일로 처음부터 합니다.",
  locked: "누가 현황 파일을 열어 두었습니다. 닫고 다시 누르세요.",
  after_check:
    "현황 파일은 이미 올라갔지만, 다시 읽은 행 수가 맞지 않습니다. 관리자에게 알려 주세요.",
  dependency_failed: "앞 단계가 실패해 이 단계를 건너뛰었습니다.",
  unknown: "예상하지 못한 오류입니다. 관리자에게 알려 주세요.",
  poller_crashed:
    "회사 PC 처리 중 멈췄습니다. 다시 누르고, 또 멈추면 관리자에게 알려 주세요.",
};

export function failureCopy(code: string): string {
  return FAILURE_COPY[code] ?? FAILURE_COPY.unknown;
}

export const stepResultSchema = z.object({
  step: z.string().min(1).max(20),
  status: z.enum(["ok", "failed", "skipped"]),
  summary: z.string().max(300),
  counts: z.record(z.string(), z.number().int()).default({}),
  error: z
    .object({
      code: z.string().min(1).max(40),
      detail: z.string().max(300).optional(),
    })
    .nullable(),
  watermark: z.iso.datetime({ offset: true }).nullable().optional(),
});

export const refreshResultSchema = z.object({
  version: z.literal(1),
  steps: z.array(stepResultSchema).max(10),
  changes: z.array(z.string().max(300)).max(200).default([]),
});

export const completeBodySchema = z.object({
  id: z.string().uuid(),
  ok: z.boolean(),
  message: z.string().max(500).optional(),
  result: refreshResultSchema.optional(),
});

export type StepResult = z.infer<typeof stepResultSchema>;
export type RefreshResult = z.infer<typeof refreshResultSchema>;
export type CompleteBody = z.infer<typeof completeBodySchema>;

/** 모든 단계가 ok 일 때만 done. 부분 성공도 실패로 보여 다시 누르게 한다. */
export function finalStatus(body: CompleteBody): "done" | "failed" {
  const steps = body.result?.steps ?? [];
  const allOk = steps.length > 0 && steps.every((s) => s.status === "ok");
  return body.ok && allOk ? "done" : "failed";
}

function stepOutcome(s: StepResult): string {
  if (s.status === "ok") return "성공";
  if (s.status === "skipped") return "건너뜀";
  return `실패(${s.error?.code ?? "unknown"})`;
}

/**
 * 자동화 실행 기록용 한 줄 — 단계 라벨·성패·코드만.
 * summary·message 원문은 번호가 섞일 수 있어 싣지 않는다.
 */
export function runMessage(body: CompleteBody): string {
  const steps = body.result?.steps ?? [];
  if (steps.length === 0) return "회사 PC 처리 실패 — 결과 없음";
  return steps.map((s) => `${stepLabel(s.step)} ${stepOutcome(s)}`).join(" · ");
}

/** 이번 실행에서 전진한 기준 시각 — ok 단계의 것만. */
export function advancedWatermarks(
  result: RefreshResult,
): Record<string, string> {
  return mergeWatermarks(
    result.steps
      .filter((s) => s.status === "ok" && s.watermark)
      .map((s) => ({ [s.step]: s.watermark as string })),
  );
}

/** 키마다 가장 늦은 시각. 문자열이 아니라 시각으로 비교하고, 읽을 수 없는 값은 버린다. */
export function mergeWatermarks(
  list: readonly Record<string, string>[],
): Record<string, string> {
  return list
    .flatMap((wm) => Object.entries(wm))
    .reduce<Record<string, string>>((acc, [key, value]) => {
      const ms = Date.parse(value);
      if (Number.isNaN(ms)) return acc;
      const prev = acc[key];
      if (prev !== undefined && Date.parse(prev) >= ms) return acc;
      return { ...acc, [key]: value };
    }, {});
}

// ── 화면 타입 (history.ts 가 채운다) ──

export type RequestStatus = "pending" | "running" | "done" | "failed";

export type RefreshHistoryItem = {
  id: string;
  requestedAt: string;
  finishedAt: string | null;
  requester: string;
  status: RequestStatus;
  steps: {
    label: string;
    status: "ok" | "failed" | "skipped";
    summary: string;
    action: string | null;
  }[];
  changes: string[];
  note: string | null;
};

export type StatusRefreshView = {
  canRequest: boolean;
  active: { status: "pending" | "running"; requestedAt: string } | null;
  history: RefreshHistoryItem[];
  loadError: string | null;
};
