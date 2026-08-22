import { describe, it, expect } from "vitest";
import { phaseOf, PHASES, type ServicePhase } from "../phase";

const NOW = new Date("2026-08-22T00:00:00Z");
const at = (d: string) => `${d}T00:00:00Z`;

/**
 * 서비스는 세 단계를 지난다. 메뉴가 각 단계를 하나씩 맡는다.
 *
 * - **개발·테스트** — 아직 시작 전. 열기 전에 테스트한다.
 * - **배포·운영** — 접수 중. 지금 돌보는 대상.
 * - **서비스마감·전형료정산** — 결제까지 끝남.
 *
 * 겹치면 안 된다. 한 서비스가 두 메뉴에 나오면 어디서 처리해야 할지 모른다.
 */
describe("서비스 단계", () => {
  it("작성 시작 전이면 시작 전이다", () => {
    expect(
      phaseOf({ write_start_at: at("2026-09-01"), pay_end_at: at("2026-10-01") }, NOW),
    ).toBe("upcoming");
  });

  it("시작했고 결제가 안 끝났으면 진행 중이다", () => {
    expect(
      phaseOf({ write_start_at: at("2026-08-01"), pay_end_at: at("2026-09-01") }, NOW),
    ).toBe("running");
  });

  it("결제가 끝났으면 마감이다", () => {
    expect(
      phaseOf({ write_start_at: at("2026-07-01"), pay_end_at: at("2026-08-01") }, NOW),
    ).toBe("closed");
  });

  /**
   * 실제 데이터에 결제마감이 작성시작보다 1년 앞선 건이 있다
   * (강릉영동대 수시1차 — 작성시작 2026-09-07, 결제마감 2025-09-30).
   * 원본 스크래핑의 연도 오류로 보인다. 그래도 어딘가 하나에는 들어가야 한다.
   */
  it("결제마감이 지났으면 시작 전보다 마감이 이긴다 — 겹치면 안 된다", () => {
    expect(
      phaseOf({ write_start_at: at("2026-09-07"), pay_end_at: at("2025-09-30") }, NOW),
    ).toBe("closed");
  });

  it("날짜가 없으면 진행 중으로 둔다 — 빠뜨리는 것보다 눈에 띄는 게 낫다", () => {
    expect(phaseOf({ write_start_at: null, pay_end_at: null }, NOW)).toBe(
      "running",
    );
  });

  it("결제마감만 없으면 시작 여부로만 가른다", () => {
    expect(
      phaseOf({ write_start_at: at("2026-09-01"), pay_end_at: null }, NOW),
    ).toBe("upcoming");
    expect(
      phaseOf({ write_start_at: at("2026-08-01"), pay_end_at: null }, NOW),
    ).toBe("running");
  });

  it("세 단계뿐이다", () => {
    expect(PHASES).toEqual(["upcoming", "running", "closed"]);
  });

  it("모든 서비스는 정확히 한 단계에 든다", () => {
    const rows = [
      { write_start_at: at("2026-09-01"), pay_end_at: at("2026-10-01") },
      { write_start_at: at("2026-08-01"), pay_end_at: at("2026-09-01") },
      { write_start_at: at("2026-07-01"), pay_end_at: at("2026-08-01") },
      { write_start_at: at("2026-09-07"), pay_end_at: at("2025-09-30") },
      { write_start_at: null, pay_end_at: null },
    ];
    const counted: Record<ServicePhase, number> = {
      upcoming: 0,
      running: 0,
      closed: 0,
    };
    for (const r of rows) counted[phaseOf(r, NOW)] += 1;
    expect(counted.upcoming + counted.running + counted.closed).toBe(
      rows.length,
    );
  });
});
