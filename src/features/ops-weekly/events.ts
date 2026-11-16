// 주간업무보고 이벤트 훅 — A2(메일)·A3(엑셀·워드)가 `OPS_WEEKLY_HOOKS` 에 등록하는 자리다.
// A1 은 훅이 비어 있어 아무것도 보내지 않고 쓰지 않는다.

export type OpsWeeklyEvent =
  | {
      type: "all-submitted";
      weekId: string;
      weekStart: string;
      dutyEmail: string | null;
    }
  | {
      type: "report-returned";
      weekId: string;
      weekStart: string;
      operatorEmail: string;
      returnedBy: string;
      reason: string | null;
    }
  | {
      type: "week-reported";
      weekId: string;
      weekStart: string;
      reportedBy: string;
      correction: boolean;
    };

export type OpsWeeklyHook = {
  name: string;
  handle: (event: OpsWeeklyEvent) => Promise<void>;
};

export const OPS_WEEKLY_HOOKS: readonly OpsWeeklyHook[] = [];

export type HookOutcome = { name: string; ok: boolean; error?: string };

/**
 * 훅마다 따로 잡는다 — 한 훅이 실패해도 다른 훅과 호출한 action 은 계속 간다(spec §6.3).
 * 실패를 화면에 남기는 일은 A3 이 한다. 던지지 않는다.
 */
export async function emitOpsWeeklyEvent(
  event: OpsWeeklyEvent,
  hooks: readonly OpsWeeklyHook[] = OPS_WEEKLY_HOOKS,
): Promise<HookOutcome[]> {
  const outcomes: HookOutcome[] = [];
  for (const hook of hooks) {
    try {
      await hook.handle(event);
      outcomes.push({ name: hook.name, ok: true });
    } catch (e) {
      outcomes.push({
        name: hook.name,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return outcomes;
}
