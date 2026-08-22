import { describe, it, expect } from "vitest";
import { deriveStatusByService, type MailSendStatusRow } from "../status";

/**
 * data-requests/queries.ts 에서 이관. 규칙은 그대로 두고 키 정규화만 넓혔다
 * — 오픈안내는 service_id 가 정수(Moa 서비스ID)라 같은 함수를 쓰려면
 * 숫자 키도 받아야 한다.
 */
describe("deriveStatusByService", () => {
  it("scheduled 발송 건은 '예약됨' + 예약 시각", () => {
    const rows: MailSendStatusRow[] = [
      { service_id: "a", status: "scheduled", scheduled_at: "2026-06-01T01:00:00Z", sent_at: null },
    ];
    expect(deriveStatusByService(rows)).toEqual({
      a: { status: "scheduled", scheduledAt: "2026-06-01T01:00:00Z", lastSentAt: null, lastFailedAt: null },
    });
  });

  it("sent 발송 건은 '발송됨' + 최근 발송 시각", () => {
    const rows: MailSendStatusRow[] = [
      { service_id: "a", status: "sent", scheduled_at: null, sent_at: "2026-05-20T01:00:00Z" },
      { service_id: "a", status: "sent", scheduled_at: null, sent_at: "2026-05-22T03:00:00Z" },
    ];
    expect(deriveStatusByService(rows)).toEqual({
      a: { status: "sent", scheduledAt: null, lastSentAt: "2026-05-22T03:00:00Z", lastFailedAt: null },
    });
  });

  it("예약 + 발송이 함께 있으면 예약됨 우선 (lastSentAt도 보존)", () => {
    const rows: MailSendStatusRow[] = [
      { service_id: "a", status: "sent", scheduled_at: null, sent_at: "2026-05-20T01:00:00Z" },
      { service_id: "a", status: "scheduled", scheduled_at: "2026-06-05T00:00:00Z", sent_at: null },
    ];
    expect(deriveStatusByService(rows)).toEqual({
      a: { status: "scheduled", scheduledAt: "2026-06-05T00:00:00Z", lastSentAt: "2026-05-20T01:00:00Z", lastFailedAt: null },
    });
  });

  it("예약이 여러 건이면 가장 이른 예약 시각", () => {
    const rows: MailSendStatusRow[] = [
      { service_id: "a", status: "scheduled", scheduled_at: "2026-06-10T00:00:00Z", sent_at: null },
      { service_id: "a", status: "scheduled", scheduled_at: "2026-06-03T00:00:00Z", sent_at: null },
    ];
    expect(deriveStatusByService(rows).a).toEqual({
      status: "scheduled",
      scheduledAt: "2026-06-03T00:00:00Z",
      lastSentAt: null,
      lastFailedAt: null,
    });
  });

  it("failed/dry_run/pending만 있으면 상태 null", () => {
    const rows: MailSendStatusRow[] = [
      { service_id: "a", status: "failed", scheduled_at: null, sent_at: null },
      { service_id: "a", status: "dry_run", scheduled_at: null, sent_at: null },
    ];
    // created_at 이 없으면 실패 시각을 알 수 없다 → null
    expect(deriveStatusByService(rows).a).toEqual({
      status: null,
      scheduledAt: null,
      lastSentAt: null,
      lastFailedAt: null,
    });
  });

  it("service_id null 행은 무시", () => {
    const rows: MailSendStatusRow[] = [
      { service_id: null, status: "scheduled", scheduled_at: "2026-06-01T00:00:00Z", sent_at: null },
    ];
    expect(deriveStatusByService(rows)).toEqual({});
  });

  it("정수 service_id는 문자열 키로 정규화 (오픈안내 경로)", () => {
    const rows: MailSendStatusRow[] = [
      { service_id: 1130058, status: "sent", scheduled_at: null, sent_at: "2026-09-01T00:00:00Z" },
    ];
    expect(deriveStatusByService(rows)).toEqual({
      "1130058": { status: "sent", scheduledAt: null, lastSentAt: "2026-09-01T00:00:00Z", lastFailedAt: null },
    });
  });

  it("failed 는 lastFailedAt 으로만 노출하고 status 는 건드리지 않는다", () => {
    // status 에 'failed' 를 넣으면 자료요청 배지 동작이 같이 바뀐다. 추가 필드로만 낸다.
    const rows: MailSendStatusRow[] = [
      { service_id: "a", status: "failed", scheduled_at: null, sent_at: null, created_at: "2026-09-01T00:00:00Z" },
    ];
    expect(deriveStatusByService(rows).a).toEqual({
      status: null,
      scheduledAt: null,
      lastSentAt: null,
      lastFailedAt: "2026-09-01T00:00:00Z",
    });
  });

  it("실패가 여러 건이면 가장 최근 실패", () => {
    const rows: MailSendStatusRow[] = [
      { service_id: "a", status: "failed", scheduled_at: null, sent_at: null, created_at: "2026-09-01T00:00:00Z" },
      { service_id: "a", status: "failed", scheduled_at: null, sent_at: null, created_at: "2026-09-03T00:00:00Z" },
    ];
    expect(deriveStatusByService(rows).a.lastFailedAt).toBe("2026-09-03T00:00:00Z");
  });

  it("발송 성공이 있으면 실패가 있어도 status 는 sent", () => {
    const rows: MailSendStatusRow[] = [
      { service_id: "a", status: "failed", scheduled_at: null, sent_at: null, created_at: "2026-09-01T00:00:00Z" },
      { service_id: "a", status: "sent", scheduled_at: null, sent_at: "2026-09-02T00:00:00Z" },
    ];
    const r = deriveStatusByService(rows).a;
    expect(r.status).toBe("sent");
    expect(r.lastFailedAt).toBe("2026-09-01T00:00:00Z");
  });

  it("service_id 0은 무시하지 않는다 (falsy 함정)", () => {
    const rows: MailSendStatusRow[] = [
      { service_id: 0, status: "sent", scheduled_at: null, sent_at: "2026-09-01T00:00:00Z" },
    ];
    expect(deriveStatusByService(rows)["0"]?.status).toBe("sent");
  });
});
