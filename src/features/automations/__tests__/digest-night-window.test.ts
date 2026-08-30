import { describe, it, expect } from "vitest";
import { buildDigest } from "../digest";
import type { DigestInput } from "../digest";
import { AUTOMATION_JOBS } from "../registry";

/** 일일 보고가 도는 시각(11:00 KST). */
const NOW = new Date("2026-08-31T11:00:00+09:00");

function mailboxInput(over: Partial<DigestInput> = {}): DigestInput {
  return {
    job: { id: "mailbox-ingest", label: "메일함 AI 초안 생성", cadence: "hourly" },
    enabled: true,
    lastRunAt: "2026-08-31T10:50:00+09:00",
    todayRuns: [],
    ...over,
  };
}

const run = (ranAt: string) => ({ ranAt, ok: true, skipped: false, message: "" });

/**
 * 메일함 수집을 **야간(20~08시)에 세운다.**
 *
 * 실측: 최근 7일 1,000회 중 실제 수집은 51회(5.1%)이고 **00~08시·20~23시
 * 504회는 7일 내내 전부 빈손**이었다. 수집은 `last_synced_at` 델타라 밤에
 * 꺼도 아침 첫 실행이 밀린 메일을 가져온다.
 *
 * 문제는 **미실행 감지가 이걸 장애로 오해하느냐**다. 야간 공백(12h)이
 * `hourly` 임계(3h)보다 크기 때문에, 판정이 '오늘 실행'을 먼저 보지 않으면
 * 매일 아침 거짓 경보가 온다. 그 계약을 여기서 못박는다.
 */
describe("메일함 수집 야간 정지 — 미실행 판정", () => {
  it("야간에 안 돌아도 오늘 돈 기록이 있으면 정상이다 — 거짓 경보 금지", () => {
    const [state] = buildDigest(
      [
        mailboxInput({
          // 어제 20:00 이후 공백 12시간, 오늘 08:00부터 재개.
          todayRuns: [
            run("2026-08-31T08:00:00+09:00"),
            run("2026-08-31T10:50:00+09:00"),
          ],
        }),
      ],
      NOW,
    );
    expect(state.status).toBe("ok");
  });

  /**
   * 야간 정지를 이유로 임계를 늘리면(hourly→daily, 3h→48h) **회사 PC가 꺼진
   * 하루를 놓친다.** 그래서 cadence 는 그대로 두고, 위 계약으로 지킨다.
   */
  it("하루 종일 안 돌면 여전히 잡아낸다 — 임계를 늘리지 않은 이유", () => {
    const [state] = buildDigest(
      [
        mailboxInput({
          todayRuns: [],
          lastRunAt: "2026-08-30T20:00:00+09:00", // 어제 마지막 실행
        }),
      ],
      NOW,
    );
    expect(state.status).toBe("stale");
  });

  it("cadence 는 hourly 그대로다 — 늘리면 하루치 장애를 못 잡는다", () => {
    const job = AUTOMATION_JOBS.find((j) => j.id === "mailbox-ingest");
    expect(job?.cadence).toBe("hourly");
  });

  /** 등록 스크립트를 고쳐도 화면 문구가 그대로면 사람이 24시간으로 안다. */
  it("화면 문구가 실행 시간대를 말한다", () => {
    const job = AUTOMATION_JOBS.find((j) => j.id === "mailbox-ingest");
    expect(job?.scheduleInfo).toMatch(/08.*20/);
  });
});
