/**
 * 메일 발송 이력 → 서비스별 상태 파생. 도메인 공용(자료요청·오픈안내).
 *
 * 한 벌만 둔다 — "예약 우선, 발송 차선"이라는 우선순위 규칙이 두 벌이 되면
 * 화면마다 다른 배지를 띄우는 방식으로 조용히 갈린다.
 *
 * 키는 `String()` 으로 정규화한다. 자료요청은 services.id(uuid)이고
 * 오픈안내는 closing_services.service_id(정수)라 원본 타입이 다르다.
 */

export type MailSendStatusRow = {
  /** uuid(자료요청) 또는 Moa 서비스ID 정수(오픈안내) */
  service_id: string | number | null;
  status: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  /** 실패 시각의 출처 — 실패 행은 sent_at 이 비어 있다. 없으면 실패 시각 미상. */
  created_at?: string | null;
};

/** 서비스별 메일 상태 — 인스펙터/목록 배지용 */
export type ServiceMailStatus = {
  /** 미래/대기 예약이 있으면 'scheduled', 아니면 발송 이력이 있으면 'sent', 둘 다 없으면 null */
  status: "scheduled" | "sent" | null;
  /** 가장 이른 예약 시각 (status='scheduled'일 때) */
  scheduledAt: string | null;
  /** 가장 최근 발송 시각 (발송 이력 있으면) */
  lastSentAt: string | null;
  /**
   * 가장 최근 실패 시각. **`status` 에는 반영하지 않는다** — 'failed' 를
   * status 에 넣으면 자료요청 배지 동작까지 같이 바뀐다. 읽는 쪽이 필요할 때만
   * 본다(오픈안내는 자동 발송이라 실패가 조용히 묻히면 안 된다).
   */
  lastFailedAt: string | null;
};

/**
 * 서비스별 send 행들을 메일 상태로 환원 (순수).
 * 우선순위: 대기 예약(scheduled/sending) > 발송(sent). failed/dry_run/pending은 상태 없음.
 */
export function deriveStatusByService(
  rows: MailSendStatusRow[],
): Record<string, ServiceMailStatus> {
  const out: Record<string, ServiceMailStatus> = {};
  for (const r of rows) {
    // `!r.service_id` 가 아니다 — 정수 키가 들어오면서 0이 falsy로 걸린다.
    if (r.service_id == null) continue;
    const key = String(r.service_id);
    const cur =
      out[key] ??
      ({
        status: null,
        scheduledAt: null,
        lastSentAt: null,
        lastFailedAt: null,
      } as ServiceMailStatus);
    if ((r.status === "scheduled" || r.status === "sending") && r.scheduled_at) {
      if (!cur.scheduledAt || r.scheduled_at < cur.scheduledAt) {
        cur.scheduledAt = r.scheduled_at; // 가장 이른 예약
      }
    }
    if (r.status === "sent" && r.sent_at) {
      if (!cur.lastSentAt || r.sent_at > cur.lastSentAt) {
        cur.lastSentAt = r.sent_at; // 가장 최근 발송
      }
    }
    if (r.status === "failed" && r.created_at) {
      if (!cur.lastFailedAt || r.created_at > cur.lastFailedAt) {
        cur.lastFailedAt = r.created_at; // 가장 최근 실패
      }
    }
    out[key] = cur;
  }
  for (const k of Object.keys(out)) {
    const v = out[k];
    v.status = v.scheduledAt ? "scheduled" : v.lastSentAt ? "sent" : null;
  }
  return out;
}
