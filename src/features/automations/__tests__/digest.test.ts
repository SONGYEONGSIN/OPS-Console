import { describe, it, expect } from "vitest";
import { buildDigest, renderDigestHtml, isSameKstDay } from "../digest";
import type { DigestInput } from "../digest";

const NOW = new Date("2026-08-06T11:00:00+09:00");

function input(over: Partial<DigestInput> = {}): DigestInput {
  return {
    job: { id: "job-a", label: "잡 A", cadence: "weekday" },
    enabled: true,
    lastRunAt: "2026-08-06T09:00:00+09:00",
    todayRuns: [],
    ...over,
  };
}

const run = (over: Partial<DigestInput["todayRuns"][number]> = {}) => ({
  ranAt: "2026-08-06T09:00:00+09:00",
  ok: true,
  skipped: false,
  message: "",
  ...over,
});

describe("buildDigest", () => {
  it("오늘 실패가 있으면 failed — 최신 실패 사유를 싣는다", () => {
    const [state] = buildDigest(
      [
        input({
          todayRuns: [
            run({
              ok: false,
              message: "엑셀 다운로드 타임아웃",
              ranAt: "2026-08-06T09:08:00+09:00",
            }),
            run({
              ok: false,
              message: "예전 실패",
              ranAt: "2026-08-06T08:00:00+09:00",
            }),
          ],
        }),
      ],
      NOW,
    );
    expect(state.status).toBe("failed");
    expect(state.message).toBe("엑셀 다운로드 타임아웃");
    expect(state.failCount).toBe(2);
  });

  it("오늘 성공만 있으면 ok — 실행 횟수를 센다 (매시간 잡)", () => {
    const [state] = buildDigest(
      [
        input({
          job: { id: "match", label: "입금 매칭", cadence: "hourly" },
          todayRuns: [run(), run(), run()],
        }),
      ],
      NOW,
    );
    expect(state.status).toBe("ok");
    expect(state.runCount).toBe(3);
    expect(state.failCount).toBe(0);
  });

  it("오늘 기록이 없고 마지막 실행이 주기 임계를 넘으면 stale", () => {
    // 매시간 잡인데 5시간째 기록이 없다 — 스케줄러가 죽은 신호.
    const [state] = buildDigest(
      [
        input({
          job: { id: "match", label: "입금 매칭", cadence: "hourly" },
          lastRunAt: "2026-08-06T06:00:00+09:00",
        }),
      ],
      NOW,
    );
    expect(state.status).toBe("stale");
  });

  it("오늘 기록이 없어도 주기 임계 이내면 idle — 주간·월간 잡 오탐 방지", () => {
    const [state] = buildDigest(
      [
        input({
          job: { id: "insights", label: "인사이트 수집", cadence: "weekly" },
          lastRunAt: "2026-08-03T10:00:00+09:00",
        }),
      ],
      NOW,
    );
    expect(state.status).toBe("idle");
  });

  it("평일 잡은 주말 공백(금→월)으로 stale이 되지 않는다", () => {
    // 금요일 10:00 실행 → 월요일 11:00 판정 시점까지 73시간.
    const [state] = buildDigest(
      [
        input({
          job: { id: "mail", label: "미수채권 알림", cadence: "weekday" },
          lastRunAt: "2026-08-03T10:00:00+09:00",
        }),
      ],
      new Date("2026-08-06T11:00:00+09:00"),
    );
    expect(state.status).toBe("idle");
  });

  it("자동 실행 OFF면 off — 미실행으로 잡지 않는다", () => {
    const [state] = buildDigest(
      [input({ enabled: false, lastRunAt: "2026-01-01T09:00:00+09:00" })],
      NOW,
    );
    expect(state.status).toBe("off");
  });

  it("수동 전용 잡은 오래 안 돌아도 stale이 아니다", () => {
    const [state] = buildDigest(
      [
        input({
          job: {
            id: "ratio",
            label: "경쟁률 점검",
            cadence: "manual",
            manualOnly: true,
          },
          lastRunAt: "2026-01-01T09:00:00+09:00",
        }),
      ],
      NOW,
    );
    expect(state.status).toBe("idle");
  });

  it("실행 기록이 아예 없으면 stale", () => {
    const [state] = buildDigest([input({ lastRunAt: null })], NOW);
    expect(state.status).toBe("stale");
    expect(state.message).toContain("실행 기록 없음");
  });

  it("오늘 skipped만 있으면 skipped", () => {
    const [state] = buildDigest(
      [
        input({
          todayRuns: [run({ skipped: true, message: "자동 실행 OFF" })],
        }),
      ],
      NOW,
    );
    expect(state.status).toBe("skipped");
  });

  it("문제 건(failed·stale)을 앞으로 정렬한다", () => {
    const states = buildDigest(
      [
        input({
          job: { id: "ok-job", label: "정상 잡", cadence: "weekday" },
          todayRuns: [run()],
        }),
        input({
          job: { id: "stale-job", label: "미실행 잡", cadence: "weekday" },
          lastRunAt: null,
        }),
        input({
          job: { id: "fail-job", label: "실패 잡", cadence: "weekday" },
          todayRuns: [run({ ok: false, message: "터짐" })],
        }),
      ],
      NOW,
    );
    expect(states.map((s) => s.jobId)).toEqual([
      "fail-job",
      "stale-job",
      "ok-job",
    ]);
  });
});

describe("renderDigestHtml", () => {
  const states = buildDigest(
    [
      input({
        job: {
          id: "closing-scrape",
          label: "서비스 마감 스크래핑",
          cadence: "weekday",
        },
        todayRuns: [
          run({
            ok: false,
            message: "엑셀 다운로드 타임아웃",
            ranAt: "2026-08-06T09:08:00+09:00",
          }),
        ],
      }),
      input({
        job: { id: "match", label: "입금 매칭 자동화", cadence: "hourly" },
        todayRuns: [run(), run()],
      }),
    ],
    NOW,
  );

  it("요약 카운트와 실패 사유를 싣는다", () => {
    const html = renderDigestHtml(states, NOW);
    expect(html).toContain("자동화 일일 보고");
    expect(html).toContain("서비스 마감 스크래핑");
    expect(html).toContain("엑셀 다운로드 타임아웃");
    expect(html).toContain("정상 1");
    expect(html).toContain("실패 1");
  });

  it("이미지를 넣지 않는다 — Teams 본문은 인라인 이미지를 블록으로 떨어뜨린다", () => {
    expect(renderDigestHtml(states, NOW)).not.toContain("<img");
  });

  it("문제가 없으면 '이상 없음'으로 끝낸다", () => {
    const okOnly = buildDigest([input({ todayRuns: [run()] })], NOW);
    expect(renderDigestHtml(okOnly, NOW)).toContain("이상 없음");
  });
});

describe("isSameKstDay", () => {
  const now = new Date("2026-08-06T11:00:00+09:00");

  it("같은 KST 날짜면 true", () => {
    expect(isSameKstDay("2026-08-06T00:05:00+09:00", now)).toBe(true);
    expect(isSameKstDay("2026-08-06T23:59:00+09:00", now)).toBe(true);
  });

  it("전날이면 false", () => {
    expect(isSameKstDay("2026-08-05T23:59:00+09:00", now)).toBe(false);
  });

  it("UTC 표기여도 KST 기준으로 판정한다", () => {
    // 2026-08-05T16:00Z = 2026-08-06 01:00 KST → 오늘.
    expect(isSameKstDay("2026-08-05T16:00:00Z", now)).toBe(true);
    // 2026-08-05T14:00Z = 2026-08-05 23:00 KST → 어제.
    expect(isSameKstDay("2026-08-05T14:00:00Z", now)).toBe(false);
  });

  it("깨진 값은 false", () => {
    expect(isSameKstDay("", now)).toBe(false);
    expect(isSameKstDay("nope", now)).toBe(false);
  });
});
