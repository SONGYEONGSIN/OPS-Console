import { describe, it, expect } from "vitest";
import { automationJobIdFor, buildRunMessage } from "../run-message";

/**
 * 점검 결과를 자동화 실행 로그에 남긴다.
 *
 * 지금까지 로그에 남던 건 **큐 적재뿐**이었다. 그래서 8/3 건이 트레이스백으로
 * 죽었는데도 화면엔 "성공"이 떠 있었고, `ratio_audit_runs`는 **한 번도 채워진 적이
 * 없었다**(2026-08-19 확인). 실행했는지도, 무엇이 나왔는지도 알 수 없었다.
 *
 * CLAUDE.md가 이미 경고한 함정이다 — 회사 PC 잡은 보고 endpoint에서
 * recordAutomationRun 을 불러야 두 경로(즉시 실패 알림·일일 보고)에 잡힌다.
 */
describe("automationJobIdFor", () => {
  it("세팅 점검과 페이지 점검은 다른 잡이다", () => {
    expect(automationJobIdFor("schedule")).toBe("ratio-audit");
    expect(automationJobIdFor("page")).toBe("ratio-page-check");
  });

  it("모르는 종류면 던진다 — 엉뚱한 잡에 기록하면 그 잡이 도는 줄 안다", () => {
    expect(() => automationJobIdFor("몰라" as "schedule")).toThrow();
  });
});

describe("buildRunMessage", () => {
  const base = {
    scannedCount: 241,
    findingCount: 3,
    linkErrorCount: 0,
    judgeFailedCount: 0,
    status: "ok" as const,
  };

  it("검사·이상·링크오류·발송을 한 줄로 — 미수채권 알림 로그와 같은 결", () => {
    const m = buildRunMessage(base, {
      sent: 2,
      failed: [],
      unassignedCount: 0,
      excludedCount: 0,
      adminNotified: true,
    });
    expect(m).toContain("검사 241건");
    expect(m).toContain("이상 3건");
    expect(m).toContain("발송 2명");
  });

  it("이상이 없으면 그것도 말한다 — 빈 줄이면 안 돈 것과 구분이 안 된다", () => {
    const m = buildRunMessage(
      { ...base, findingCount: 0 },
      { sent: 0, failed: [], unassignedCount: 0, excludedCount: 0, adminNotified: false },
    );
    expect(m).toContain("검사 241건");
    expect(m).toContain("이상 없음");
  });

  it("발송 실패는 드러낸다 — 판정은 됐는데 아무도 못 받은 경우가 최악이다", () => {
    const m = buildRunMessage(base, {
      sent: 1,
      failed: [{ operatorName: "김철수", reason: "채팅 생성 실패" }],
      unassignedCount: 0,
      excludedCount: 0,
      adminNotified: true,
    });
    expect(m).toContain("발송실패 1명");
  });

  it("담당 미상·예외 제외도 남긴다 — 조용히 빠지면 안 된다", () => {
    const m = buildRunMessage(base, {
      sent: 1,
      failed: [],
      unassignedCount: 2,
      excludedCount: 1,
      adminNotified: true,
    });
    expect(m).toContain("담당미상 2건");
    expect(m).toContain("예외제외 1건");
  });

  it("건너뛴 게 있으면 partial임을 드러낸다", () => {
    const m = buildRunMessage(
      { ...base, status: "partial" },
      { sent: 0, failed: [], unassignedCount: 0, excludedCount: 0, adminNotified: false },
    );
    expect(m).toContain("일부 건너뜀");
  });

  it("0건이어도 군더더기를 붙이지 않는다 — 없는 건 안 쓴다", () => {
    const m = buildRunMessage(
      { ...base, findingCount: 0, linkErrorCount: 0 },
      { sent: 0, failed: [], unassignedCount: 0, excludedCount: 0, adminNotified: false },
    );
    expect(m).not.toContain("담당미상");
    expect(m).not.toContain("예외제외");
    expect(m).not.toContain("발송실패");
  });

  describe("판정 실패", () => {
    const none = {
      sent: 0,
      failed: [],
      unassignedCount: 0,
      excludedCount: 0,
      adminNotified: false,
    };

    it("'판정 못 함 N건'을 맨 앞에 둔다", () => {
      const m = buildRunMessage(
        { ...base, scannedCount: 116, findingCount: 0, judgeFailedCount: 66, status: "partial" },
        none,
      );
      expect(m.startsWith("판정 못 함 66건")).toBe(true);
    });

    it("이상 0건이어도 '이상 없음'이라 쓰지 않고 판정된 수 기준임을 밝힌다", () => {
      const m = buildRunMessage(
        { ...base, scannedCount: 116, findingCount: 0, judgeFailedCount: 66, status: "partial" },
        none,
      );
      expect(m).not.toContain("이상 없음");
      expect(m).toContain("이상 0건(판정된 50건 기준)");
    });

    it("판정된 수는 음수가 되지 않는다", () => {
      const m = buildRunMessage(
        { ...base, scannedCount: 3, findingCount: 0, judgeFailedCount: 9, status: "partial" },
        none,
      );
      expect(m).toContain("판정된 0건 기준");
    });

    it("이상이 있어도 판정 못 함은 맨 앞이다", () => {
      const m = buildRunMessage(
        { ...base, scannedCount: 116, findingCount: 2, judgeFailedCount: 10, status: "partial" },
        none,
      );
      expect(m.startsWith("판정 못 함 10건")).toBe(true);
      expect(m).toContain("이상 2건");
    });

    it("수집 단계 건너뜀만 있으면 기존 문구를 유지한다", () => {
      const m = buildRunMessage(
        { ...base, findingCount: 0, judgeFailedCount: 0, status: "partial" },
        none,
      );
      expect(m).toContain("이상 없음");
      expect(m).toContain("일부 건너뜀");
      expect(m).not.toContain("판정 못 함");
    });
  });
});
