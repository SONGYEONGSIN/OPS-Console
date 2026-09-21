import { describe, it, expect } from "vitest";
import { AUTOMATION_JOBS } from "../registry";

/**
 * 배정 잡의 실행 방식 — **업무 흐름을 따른다**(사용자 2026-09-20).
 *
 * 흐름은 *2월 종료 → 3월 연간 배정 → 중간 신규 서비스는 건건히 → 이후 모니터링* 이고,
 * 2027학년도는 **이미 배정이 끝났다**. 연간 제안을 매일 만들면 관리자가 부르지도 않은
 * 배치가 쌓이고, 그건 *"신규 서비스 배정 요청이 없으면 굳이 제안해 줄 필요가 없다"* 와
 * 정면으로 어긋난다.
 *
 * 반대로 미배정 **감지**는 사람이 매일 누를 일이 아니라 자동으로 남는다 — 새 서비스가
 * 무주공산인 것을 아무도 모르는 쪽이 더 나쁘다.
 */
const jobOf = (id: string) => {
  const job = AUTOMATION_JOBS.find((j) => j.id === id);
  if (!job) throw new Error(`registry 에 ${id} 가 없습니다`);
  return job;
};

describe("학년도 배정 요청 — 수동 전용", () => {
  it("cadence 가 manual 이고 manualOnly 다", () => {
    const job = jobOf("assignment-year-rollover");
    expect(job.cadence).toBe("manual");
    expect(job.manualOnly).toBe(true);
  });

  it("cron 이 없다고 화면에 적는다", () => {
    /*
     * `scheduleInfo` 는 사람이 읽는 문장이라 기계 판정에는 못 쓰지만, 여기 '매일'
     * 이 남아 있으면 **안 도는 잡을 돈다고 읽는다** — cron 등록은 코드 밖이라
     * 화면 문구가 유일한 안내다.
     */
    const job = jobOf("assignment-year-rollover");
    expect(job.scheduleInfo).toMatch(/수동/);
    expect(job.scheduleInfo).not.toMatch(/매일/);
  });

  it("미실행 감지에서 빠진다 — 안 누르면 안 도는 것이 정의다", () => {
    // `digest.ts` 의 `STALE_AFTER_HOURS.manual = null` 이 그 뜻이다. cadence 가
    // daily 로 남으면 48시간마다 '안 돌았다' 가 보고된다.
    expect(jobOf("assignment-year-rollover").cadence).toBe("manual");
  });
});

describe("미배정 감지 — 평일 자동으로 남긴다", () => {
  it("cadence 가 weekday 이고 manualOnly 가 아니다", () => {
    const job = jobOf("assignment-unassigned-sweep");
    expect(job.cadence).toBe("weekday");
    expect(job.manualOnly).toBeFalsy();
  });

  it("요청을 만들지 않는다고 설명에 적는다", () => {
    // 설명이 '적재합니다' 로 남으면 화면이 하지 않는 일을 한다고 말한다.
    const job = jobOf("assignment-unassigned-sweep");
    expect(job.description).not.toMatch(/요청을 적재/);
    expect(job.description).toMatch(/신규배정/);
  });
});
