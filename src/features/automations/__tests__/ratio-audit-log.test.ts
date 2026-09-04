import { describe, it, expect } from "vitest";
import { toRatioAuditEntry } from "../run-logs-normalize";

/**
 * 경쟁률 점검 상세 로그.
 *
 * 지금까지 이 잡만 상세가 없었다 — `LOG_RESOLVERS` 에 빠져 있어 한 줄 요약만 떴고,
 * "링크오류 2건"이 **어느 대학인지 화면에서 알 길이 없었다**(2026-09-04).
 */
const pageRow = {
  ran_at: "2026-09-04T08:17:01Z",
  kind: "page",
  scanned_count: 48,
  finding_count: 0,
  link_error_count: 2,
  status: "ok",
  notified: true,
  payload: {
    kind: "page",
    scannedCount: 48,
    findings: [],
    skipped: [],
    linkErrors: [
      {
        serviceId: 5041044,
        url: "https://addon.jinhakapply.com/RatioV1/RatioH/Ratio50410441.html",
        status: 404,
        reason: "",
        universityName: "가대학교",
        serviceName: "수시1차",
        operatorName: "김운영",
      },
    ],
  },
};

const scheduleRow = {
  ran_at: "2026-09-03T02:00:00Z",
  kind: "schedule",
  scanned_count: 97,
  finding_count: 1,
  link_error_count: 0,
  status: "partial",
  notified: true,
  payload: {
    kind: "schedule",
    scannedCount: 97,
    linkErrors: [],
    skipped: [{ serviceId: 111, reason: "상세 열기 실패" }],
    findings: [
      {
        serviceId: 1046110,
        seq: 1,
        universityName: "나대학교",
        serviceName: "수시",
        operatorName: "이운영",
        scheduleLines: ["2026-09-11 18:00 공개"],
        items: [
          {
            type: "year",
            field: "top",
            found: "2025학년도",
            expect: "2026학년도",
          },
        ],
      },
    ],
  },
};

describe("toRatioAuditEntry", () => {
  it("링크오류를 대학·상태와 함께 남긴다 — 어느 대학인지 알아야 고친다", () => {
    const e = toRatioAuditEntry(pageRow);
    expect(e.linkErrors[0]).toMatchObject({
      universityName: "가대학교",
      serviceName: "수시1차",
      status: 404,
      operatorName: "김운영",
    });
  });

  it("검사 건수를 그대로 싣는다", () => {
    expect(toRatioAuditEntry(pageRow).scannedCount).toBe(48);
  });

  it("이상 건은 무엇이 어떻게 다른지까지 남긴다", () => {
    const f = toRatioAuditEntry(scheduleRow).findings[0];
    expect(f.universityName).toBe("나대학교");
    expect(f.items[0]).toMatchObject({ found: "2025학년도", expect: "2026학년도" });
  });

  it("차수를 남긴다 — 같은 서비스에 1차·2차가 따로 있다", () => {
    expect(toRatioAuditEntry(scheduleRow).findings[0].seq).toBe(1);
  });

  it("건너뛴 건도 사유와 함께 남긴다 — 조용히 빠지면 안 본 걸 본 줄 안다", () => {
    expect(toRatioAuditEntry(scheduleRow).skipped[0]).toMatchObject({
      serviceId: 111,
      reason: "상세 열기 실패",
    });
  });

  it("종류를 남긴다 — 두 점검이 한 화면에 섞이지 않는다", () => {
    expect(toRatioAuditEntry(pageRow).kind).toBe("page");
    expect(toRatioAuditEntry(scheduleRow).kind).toBe("schedule");
  });

  it("payload 가 비어도 죽지 않는다 — 구버전 행이 화면을 깨면 안 된다", () => {
    const e = toRatioAuditEntry({ ran_at: "2026-01-01T00:00:00Z", payload: null });
    expect(e.findings).toEqual([]);
    expect(e.linkErrors).toEqual([]);
    expect(e.scannedCount).toBe(0);
  });
});

/**
 * 두 잡 모두 상세를 볼 수 있어야 한다 — 세팅 점검과 페이지 점검은 별개 잡이다.
 */
describe("LOG_RESOLVERS", () => {
  it("두 잡이 등록돼 있다", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/features/automations/run-logs.ts", "utf8"),
    );
    expect(src).toContain('"ratio-audit":');
    expect(src).toContain('"ratio-page-check":');
  });

  it("kind 로 걸러 읽는다 — 두 잡이 한 테이블을 쓴다", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/features/automations/run-logs.ts", "utf8"),
    );
    expect(src).toMatch(/eq\("kind"/);
  });
});
