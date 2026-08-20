/**
 * 회사 PC에서 도는 폴러들.
 *
 * 전부 같은 모양이다 — 웹이 큐에 넣고(`pending`), 회사 PC가 가져가고(`claimed_at`),
 * 끝내면 `done`. 그래서 큐 하나만 보면 그 폴러의 생사가 나온다.
 *
 * 여기 없으면 화면에도 없다. 폴러를 새로 만들면 한 줄 더한다.
 */

export type PollerDef = {
  id: string;
  label: string;
  /** 큐 테이블. 전부 requested_at / claimed_at / status 를 갖는다. */
  table: string;
  /**
   * 이 시간을 넘도록 안 가져가면 멈춘 것으로 본다.
   *
   * 상주 폴러(2초 폴링)와 5분 간격 폴러를 같은 잣대로 볼 수 없다. 넉넉히 잡는
   * 이유는 오탐이 한 번 나면 화면 전체를 안 믿게 되기 때문이다.
   */
  thresholdMinutes: number;
  /** 멈췄을 때 무엇을 해야 하는지. 상태만 알려주면 소용없다. */
  hint: string;
};

export const POLLERS: readonly PollerDef[] = [
  {
    id: "assistant",
    label: "어시스턴트",
    table: "assistant_requests",
    // 상주(2초 폴링) — 화면이 3분까지 기다리므로 그 안에 드러나야 한다.
    thresholdMinutes: 2,
    hint: "회사 PC 작업 스케줄러의 'OPS-Console 어시스턴트 폴러'를 확인하세요 (docs/assistant-poller-setup.md)",
  },
  {
    id: "postal-extract",
    label: "우편물 판독",
    table: "postal_extract_requests",
    // 상주. 판독 자체가 30초쯤 걸려 여유를 둔다.
    thresholdMinutes: 5,
    hint: "회사 PC의 'OPS-Console 우편물 판독 폴러'를 확인하세요",
  },
  {
    id: "ratio-audit",
    label: "경쟁률 점검",
    table: "ratio_audit_requests",
    // 5분 간격 폴링 + Moa 로그인이 붙어 한 건이 길다.
    thresholdMinutes: 20,
    hint: "회사 PC의 scripts/moa-ratio/poll-local.ps1 등록 상태를 확인하세요",
  },
  {
    id: "closing-scrape",
    label: "마감 스크래핑",
    table: "closing_scrape_requests",
    thresholdMinutes: 20,
    hint: "회사 PC의 마감 스크래핑 폴러를 확인하세요",
  },
  {
    id: "entertest",
    label: "원서 테스트 실행",
    table: "entertest_test_runs",
    // 실제 원서를 작성해 보는 잡이라 한 건이 길다.
    thresholdMinutes: 30,
    hint: "회사 PC의 원서 테스트 폴러를 확인하세요",
  },
  {
    id: "dev-control",
    label: "개발탭 수동 분석",
    table: "dev_control_analyze_requests",
    thresholdMinutes: 20,
    hint: "회사 PC의 개발탭 분석 폴러를 확인하세요",
  },
];
