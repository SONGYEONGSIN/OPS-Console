import type { AgentTeam } from "./types";

/**
 * 팀 정의의 단일 소스. 화면·테스트가 여기서만 읽는다.
 *
 * 잡의 라벨·설명을 여기 복사하지 않는다 — automations/registry.ts에서 jobId로 찾아
 * 렌더한다. 복사하면 잡 설명을 고칠 때 두 곳이 되고 한쪽만 고쳐진다(#963에서 겪음).
 *
 * 팀장 이름은 성을 뺀 이름만 쓴다. 사내 별칭으로 읽히게 하려는 것이고, 실존 인물을
 * 그대로 지칭하지 않기 위해서다. 팀이 늘면 같은 계열(축구)에서 고른다.
 */
export const AGENT_TEAMS: readonly AgentTeam[] = [
  {
    id: "collect",
    name: "수집팀",
    leader: {
      name: "지성",
      tagline: "두 개의 심장 — 90분 내내 온 그라운드를 돈다",
    },
    traits: ["완주", "빠짐없이", "현장확인", "반복내성"],
    members: [
      {
        role: "마감",
        agent: "closing-scraper",
        source: { kind: "job", jobId: "closing-scrape" },
      },
      {
        role: "메일",
        agent: "mail-ingestor",
        llm: true,
        source: { kind: "job", jobId: "mailbox-ingest" },
      },
      {
        role: "영상",
        agent: "insight-collector",
        source: { kind: "job", jobId: "insights-collect" },
      },
      {
        role: "뉴스",
        agent: "news-collector",
        source: { kind: "job", jobId: "news-collect" },
      },
      {
        role: "오픈소스",
        agent: "tip-scout",
        source: { kind: "job", jobId: "ai-tips-collect" },
      },
      {
        role: "지식",
        agent: "vault-indexer",
        source: { kind: "job", jobId: "knowledge-index" },
      },
    ],
  },
  {
    id: "judge",
    name: "판단팀",
    leader: {
      name: "성용",
      tagline: "중원에서 각을 읽고 어디로 갈지 정한다",
    },
    traits: ["대조", "근거우선", "의심", "예외기억"],
    members: [
      {
        role: "세팅",
        agent: "ratio-auditor",
        llm: true,
        source: { kind: "job", jobId: "ratio-audit" },
      },
      {
        role: "링크",
        agent: "page-checker",
        source: { kind: "job", jobId: "ratio-page-check" },
      },
      {
        role: "입금",
        agent: "deposit-matcher",
        source: { kind: "job", jobId: "receivables-deposit-match" },
      },
      {
        role: "계약",
        agent: "contract-snapshotter",
        source: { kind: "job", jobId: "contract-completion-snapshot" },
      },
    ],
  },
  {
    id: "deliver",
    name: "전달팀",
    leader: {
      name: "강인",
      tagline: "킥이 정확하다 — 원하는 발밑에 꽂는다",
    },
    traits: ["정확한수신자", "절제", "브랜드일관", "오발신방지"],
    members: [
      {
        role: "독려(외부)",
        agent: "school-reminder",
        source: { kind: "job", jobId: "receivables-mail-school" },
      },
      {
        role: "독려(내부)",
        agent: "operator-reminder",
        source: { kind: "job", jobId: "receivables-mail-operator" },
      },
      {
        role: "세금",
        agent: "edi-notifier",
        source: { kind: "job", jobId: "smileedi-mail" },
      },
      {
        role: "서비스",
        agent: "service-notifier",
        source: { kind: "job", jobId: "service-notice-mail" },
      },
      {
        role: "공지",
        agent: "notice-broadcaster",
        source: { kind: "job", jobId: "notice-teams-share" },
      },
      {
        role: "소식지",
        agent: "briefing-writer",
        llm: true,
        source: { kind: "job", jobId: "team-briefing" },
      },
      {
        role: "보고",
        agent: "weekly-report-notifier",
        source: { kind: "job", jobId: "weekly-report-rollover" },
      },
      {
        role: "백업 예약",
        agent: "backup-dispatcher",
        source: {
          kind: "outside",
          path: "/api/backup-requests/dispatch",
          note: "예약된 백업 요청 발송 · 5분마다",
        },
      },
      {
        role: "자료 예약",
        agent: "data-request-dispatcher",
        source: {
          kind: "outside",
          path: "/api/data-requests/dispatch",
          note: "예약된 자료 요청 발송 · 5분마다",
        },
      },
    ],
  },
  {
    id: "observe",
    name: "관측팀",
    leader: {
      name: "현우",
      tagline: "골문 뒤에서 전체를 보고 먼저 소리친다",
    },
    traits: ["무소식감지", "소음억제", "비용추적", "조용함"],
    members: [
      {
        role: "일일",
        agent: "digest-reporter",
        source: { kind: "job", jobId: "automation-digest" },
      },
      {
        role: "실패",
        agent: "failure-watcher",
        source: {
          kind: "outside",
          path: "features/automations/failure-notify.ts",
          note: "실패 즉시 알림 · 중복 억제",
        },
      },
      { role: "추적", agent: "trace-recorder", source: { kind: "planned" } },
    ],
  },
  {
    id: "coordinate",
    name: "조율",
    leader: {
      name: "명보",
      tagline: "감독 — 누구를 언제 넣을지 정한다",
    },
    traits: ["확인게이트", "권한분리", "모르면모른다", "대신실행"],
    // 팀원 없이 직접 수행한다. 운영자 질문을 받아 어느 팀의 일인지 정하고
    // 승인받아 대신 실행한다. 본체 설계는 2026-08-10-assistant-system-agent-design.md
    members: [],
  },
];
