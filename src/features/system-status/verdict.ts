/**
 * 회사 PC 폴러가 살아 있는가 — 큐 테이블의 기록만으로 판정한다.
 *
 * 외부 호출을 하지 않는 이유: 폴러는 그 PC의 프로세스라 서버가 찔러볼 수단이 없다.
 * 대신 **큐가 증거를 남긴다** — 요청이 들어왔는데 아무도 안 가져가면 그게 죽은 것이다.
 *
 * **가장 조심할 것**: 마지막 claim 이 오래됐다고 죽은 게 아니다. 요청이 없으면
 * claim 도 없다. 조용한 폴러와 죽은 폴러는 **대기가 있을 때만** 구분된다. 그래서
 * 대기가 없으면 '정상'이 아니라 `unknown` 이다 — 화면이 거짓 안심을 주면 안 된다.
 */

export type PollerSample = {
  pendingCount: number;
  /** 가장 오래 기다린 대기 요청. 판정 기준이다. */
  oldestPendingAt: string | null;
  runningCount: number;
  /** 가져갔는데 안 끝난 것 중 가장 오래된 것. */
  oldestRunningAt: string | null;
  lastClaimAt: string | null;
  lastRequestAt: string | null;
  /**
   * 폴러가 마지막으로 "살아있음"을 남긴 시각.
   *
   * 큐 기록만으로는 **요청이 없을 때** 조용한 폴러와 죽은 폴러를 구분할 수 없다.
   * 심박을 안 보내는 폴러(PowerShell 쪽)는 null 이고, 그때는 예전처럼 unknown 이다.
   */
  lastBeatAt?: string | null;
};

/**
 * 이만큼 소식이 없으면 죽은 것으로 본다.
 *
 * 폴러는 1분마다 보낸다. 5분이면 네 번을 놓친 것이라 일시적 네트워크 문제로 보기
 * 어렵다 — 짧게 잡으면 오탐이 나고, 한 번 오탐이 나면 화면 전체를 안 믿게 된다.
 */
export const HEARTBEAT_STALE_MINUTES = 5;

export type PollerVerdict = "stopped" | "working" | "unknown";

export type Judgement = {
  verdict: PollerVerdict;
  detail: string;
  /** 판정 근거가 된 경과 시간(분). 화면이 정렬에 쓴다. */
  waitedMinutes: number | null;
};

const minutesSince = (iso: string, now: Date) =>
  Math.floor((now.getTime() - Date.parse(iso)) / 60_000);

export function judgePoller(
  sample: PollerSample,
  /** 이 시간을 넘도록 안 가져가면 멈춘 것으로 본다. 폴러마다 다르다. */
  thresholdMinutes: number,
  now: Date,
  /** 심박 임계. 폴러마다 주기가 달라 따로 받는다. */
  staleMinutes: number = HEARTBEAT_STALE_MINUTES,
): Judgement {
  const pendingMin = sample.oldestPendingAt
    ? minutesSince(sample.oldestPendingAt, now)
    : null;
  const runningMin = sample.oldestRunningAt
    ? minutesSince(sample.oldestRunningAt, now)
    : null;

  if (pendingMin !== null && pendingMin > thresholdMinutes) {
    return {
      verdict: "stopped",
      detail: `${sample.pendingCount}건이 ${pendingMin}분째 대기 중입니다`,
      waitedMinutes: pendingMin,
    };
  }

  // 가져간 뒤 안 끝나는 것도 멈춘 것이다 — 폴러가 일하다 죽었다.
  if (runningMin !== null && runningMin > thresholdMinutes) {
    return {
      verdict: "stopped",
      detail: `${sample.runningCount}건이 ${runningMin}분째 처리 중입니다`,
      waitedMinutes: runningMin,
    };
  }

  if (sample.pendingCount > 0 || sample.runningCount > 0) {
    return {
      verdict: "working",
      detail: `${sample.pendingCount + sample.runningCount}건 처리 중입니다`,
      waitedMinutes: pendingMin ?? runningMin,
    };
  }

  // 큐가 조용할 때는 심박이 유일한 증거다. 큐 증거(위)보다 약하게 두는 이유:
  // 폴러가 심박만 보내면서 일을 안 할 수 있고, 그때는 대기 건이 진실이다.
  if (sample.lastBeatAt) {
    const beatMin = minutesSince(sample.lastBeatAt, now);
    if (beatMin <= staleMinutes) {
      return {
        verdict: "working",
        detail: `살아 있습니다 — 심박 ${humanAgo(beatMin)}`,
        waitedMinutes: null,
      };
    }
    return {
      verdict: "stopped",
      detail: `${humanAgo(beatMin)}부터 소식이 없습니다`,
      waitedMinutes: beatMin,
    };
  }

  // 판정할 근거가 없다. 그래도 마지막으로 가져간 시각은 유일한 단서라 함께 준다 —
  // "3일 전이 마지막"과 "5분 전이 마지막"은 사람에게 전혀 다른 신호다.
  const since = sample.lastClaimAt
    ? `마지막으로 가져간 것은 ${humanAgo(minutesSince(sample.lastClaimAt, now))}입니다`
    : "가져간 기록이 아직 없습니다";

  return {
    verdict: "unknown",
    detail: `대기 중인 요청이 없어 살아 있는지 알 수 없습니다 — ${since}`,
    waitedMinutes: null,
  };
}

/** 분을 사람이 읽는 말로. 화면과 판정 문구가 갈리지 않게 여기서만 만든다. */
function humanAgo(minutes: number): string {
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 48) return `${Math.floor(minutes / 60)}시간 전`;
  return `${Math.floor(minutes / (60 * 24))}일 전`;
}
