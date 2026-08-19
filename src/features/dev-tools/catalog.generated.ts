// 이 파일은 생성물입니다. 직접 고치지 마세요.
// 다시 만들기: npm run tools:scan
import type { ToolEntry } from "./scan";

export const TOOL_CATALOG: readonly ToolEntry[] = [
  {
    "kind": "skill",
    "name": "agent-browser",
    "description": "Headless browser automation using agent-browser CLI. This skill should be used when performing headless/background web scraping, parallel multi-site operations, or simple page queries that don't require login. Triggers on requests like \"크롤링\", \"스크래핑\", \"페이지 정보\", \"헤드리스\", \"병렬로 웹 작업\", \"여러 사이트 동시에\".",
    "path": ".claude/skills/agent-browser/SKILL.md",
    "invoke": "Skill(\"agent-browser\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "auto-build",
    "description": "multi-iteration Ralph loop + persona vote 자율 사이클 — 사용자가 다른 작업 하는 동안 brainstorm → plan → 구현(TDD + ambiguity 시 24 agent 자동 vote) → /verify → /commit → /finish 까지 완주. branch 격리 + destructive op 차단 + token/file/iter cap으로 안전 보장. 사용법 /auto-build \"<task description>\"",
    "path": ".claude/skills/auto-build/SKILL.md",
    "invoke": "Skill(\"auto-build\")",
    "meta": {
      "effort": "large"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "b2b-landing",
    "description": "This skill should be used when the user requests \"B2B 랜딩\" or \"SaaS 랜딩\".",
    "path": ".claude/skills/b2b-landing/SKILL.md",
    "invoke": "Skill(\"b2b-landing\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "brainstorm",
    "description": "구현 시작 전 사용자 의도/제약/대안을 구조화 탐색하여 결정 근거를 명시한다. 결과는 .claude/memory/brainstorms/ 에 저장되어 이후 /plan 또는 직접 구현의 입력이 된다. 사용법 /brainstorm \"<주제>\"",
    "path": ".claude/skills/brainstorm/SKILL.md",
    "invoke": "Skill(\"brainstorm\")",
    "meta": {
      "effort": "medium"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "budget",
    "description": "비용 예산 프레임워크. 기본은 호출 카운트 기반(5 무거운 스킬 일일/주간 한도). --tokens 옵션으로 Claude Code session-logs/*.jsonl 파싱하여 모델별 정확 USD 비용 표시. 정보만 (차단 X).",
    "path": ".claude/skills/budget/SKILL.md",
    "invoke": "Skill(\"budget\")",
    "meta": {
      "model": "claude-sonnet-4-6"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "codebase-analyzer",
    "description": "코드베이스 종합 분석 및 개선 도구. 코드 리뷰, 버그 탐지, 리팩토링 제안, 테스트 생성, 문서화를 지원한다.\n\"코드 리뷰해줘\", \"버그 찾아줘\", \"리팩토링해줘\", \"테스트 만들어줘\", \"문서화해줘\", \"전체 점검해줘\",\n\"코드 분석해줘\", \"품질 검사해줘\", \"dead code 찾아줘\", \"미사용 코드 정리\", \"사용 안 하는 코드\" 등의 요청 시 자동으로 트리거된다.",
    "path": ".claude/skills/codebase-analyzer/SKILL.md",
    "invoke": "Skill(\"codebase-analyzer\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "commit",
    "description": "Conventional Commit 메시지를 자동 생성하고 커밋한다",
    "path": ".claude/skills/commit/SKILL.md",
    "invoke": "Skill(\"commit\")",
    "meta": {
      "effort": "low"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "debate",
    "description": "Use when a topic needs multi-perspective expert analysis before making a decision.\n\"토론해줘\", \"다각도 분석\", \"전문가 토론\", \"/debate\", \"찬반 검토\", \"여러 관점에서 봐줘\",\n\"장단점 비교\", \"의사결정 도와줘\" 요청 시 사용.\n단일 관점으로는 판단이 어렵고, 다양한 전문가 시각에서 주제를 검토·토론해야 할 때 사용.",
    "path": ".claude/skills/debate/SKILL.md",
    "invoke": "Skill(\"debate\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "dependency-manager",
    "description": "Use when checking for outdated packages, breaking changes, unused dependencies, or lock file integrity.\n\"의존성 점검\", \"패키지 업데이트\", \"outdated 확인\", \"depcheck\", \"npm outdated\",\n\"breaking change\", \"lock 파일\", \"의존성 정리\", \"패키지 정리\" 요청 시 사용.",
    "path": ".claude/skills/dependency-manager/SKILL.md",
    "invoke": "Skill(\"dependency-manager\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "deploy-safety-guard",
    "description": "\"배포 안전 점검\", \"운영 체크\", \"인프라 검증\", \"Sentry 확인\", \"환경변수 검증\", \"백엔드 점검\" 요청 시 사용.",
    "path": ".claude/skills/deploy-safety-guard/SKILL.md",
    "invoke": "Skill(\"deploy-safety-guard\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "design-audit",
    "description": "코드베이스의 디자인 시스템 준수 상태를 점검 — 하드코딩 색상, 중복 UI 패턴, 토큰 커버리지를 분석한다",
    "path": ".claude/skills/design-audit/SKILL.md",
    "invoke": "Skill(\"design-audit\")",
    "meta": {
      "effort": "medium"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "design-sync",
    "description": "참고 디자인 URL, 캡처 이미지, 또는 로컬 파일(readme.md/HTML)에서 CSS를 추출하여 현재 코드베이스와 비교/적용한다. 사용법: /design-sync <URL|이미지경로|--from-file [폴더]> [페이지경로]",
    "path": ".claude/skills/design-sync/SKILL.md",
    "invoke": "Skill(\"design-sync\")",
    "meta": {
      "effort": "high"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "discuss",
    "description": "에이전트 간 구조화된 토론을 개시하여 기술적 의견 차이를 해결한다. 사용법: /discuss <topic> [--agents agent1,agent2,...] [--rounds N]",
    "path": ".claude/skills/discuss/SKILL.md",
    "invoke": "Skill(\"discuss\")",
    "meta": {
      "effort": "medium"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "ebook-writing",
    "description": "Use when writing, drafting, or reviewing ebook chapters, sections, or full manuscripts. Triggers on \"전자책 써줘\", \"챕터 작성\", \"집필\", \"ebook writing\", \"전자책 집필\", \"원고 작성\", \"전자책 리뷰\", \"집필 리뷰\".",
    "path": ".claude/skills/ebook-writing/SKILL.md",
    "invoke": "Skill(\"ebook-writing\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "error-path-analysis",
    "description": "구현된 코드에서 유저가 에러를 만났을 때의 경험을 진단할 때 사용.\n트리거: \"에러 경로 분석\", \"에러 핸들링 점검\", \"실패 시나리오\", \"에러 UX\", \"에러 메시지 품질\",\n\"빈 상태 점검\", \"에러 바운더리\", \"오프라인 대응\", empty state, error boundary, offline handling.",
    "path": ".claude/skills/error-path-analysis/SKILL.md",
    "invoke": "Skill(\"error-path-analysis\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "eval-skill",
    "description": "지정 스킬의 evals를 실행하여 품질을 정량 측정한다. 사용법: /eval <skill-name>",
    "path": ".claude/skills/eval-skill/SKILL.md",
    "invoke": "Skill(\"eval-skill\")",
    "meta": {
      "effort": "medium"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "evolve",
    "description": "스킬 자동 개선 — eval 결과와 실패 트레이스를 분석하여 SKILL.md 개선 후보를 생성하고 A/B 비교로 검증한다. /evolve <skill-name>",
    "path": ".claude/skills/evolve/SKILL.md",
    "invoke": "Skill(\"evolve\")",
    "meta": {
      "effort": "high"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "feedback",
    "description": "최근 변경사항에 대한 코드 품질 분석과 개선 제안을 출력한다",
    "path": ".claude/skills/feedback/SKILL.md",
    "invoke": "Skill(\"feedback\")",
    "meta": {
      "effort": "high"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "finish",
    "description": "작업 완료 시 머지/PR/cleanup 경로를 자동 판정하고 후속 단계를 안내한다. 테스트/커밋/plan/branch 상태를 종합 점검 후 의사결정 트리로 명확한 다음 행동 제시. 사용법 /finish [--path pr|direct|release|cleanup]",
    "path": ".claude/skills/finish/SKILL.md",
    "invoke": "Skill(\"finish\")",
    "meta": {
      "effort": "medium"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "idea",
    "description": "\"아이디어 검증\", \"/idea\" 요청 시 사용.",
    "path": ".claude/skills/idea/SKILL.md",
    "invoke": "Skill(\"idea\")",
    "meta": {
      "allowed-tools": "Read, Write, Edit, WebSearch, WebFetch, Grep, Glob"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "inbox",
    "description": "12 에이전트 inbox + broadcast + debates 통합 뷰 + 메시지 발송. /inbox, /inbox <agent>, /inbox --unread-only, /inbox --broadcast, /inbox send <to> <subject> <body>.",
    "path": ".claude/skills/inbox/SKILL.md",
    "invoke": "Skill(\"inbox\")",
    "meta": {
      "model": "claude-sonnet-4-6"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "korean-privacy-terms",
    "description": "Next.js 웹 프로젝트에 한국 법령(개인정보보호법·약관규제법·전자상거래법) 기반 개인정보처리방침·이용약관을 자동 생성하고, shadcn/ui 기반 동의 모달·쿠키 배너·페이지 템플릿을 설치하는 스킬. 2025.4.21 작성지침 및 2026.3 개정 법령 반영.",
    "path": ".claude/skills/korean-privacy-terms/SKILL.md",
    "invoke": "Skill(\"korean-privacy-terms\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "learn",
    "description": "프로젝트 메모리에 패턴/규칙을 저장하거나 조회한다. 사용법: /learn [save|show] [pattern|error|profile]",
    "path": ".claude/skills/learn/SKILL.md",
    "invoke": "Skill(\"learn\")",
    "meta": {
      "effort": "low"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "menu",
    "description": "24 스킬 카테고리별 발견성 + 사용 분포 + Stage별 추천 강조. /menu, /menu core, /menu extensions, /menu <category>.",
    "path": ".claude/skills/menu/SKILL.md",
    "invoke": "Skill(\"menu\")",
    "meta": {
      "model": "claude-sonnet-4-6"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "metrics",
    "description": "프로젝트 메트릭 대시보드 — 빌드 성공률, 에러 빈도, 생산성 추이를 보여준다. 사용법: /metrics [today|week|all]",
    "path": ".claude/skills/metrics/SKILL.md",
    "invoke": "Skill(\"metrics\")",
    "meta": {
      "effort": "low"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "onboard",
    "description": "사용자 단계 자가진단 + 다음 행동 추천. 신규(Stage 0)~자가 진화(Stage 4) 5단계 자동 분류. 데이터 우선 (.claude/events.jsonl + .vibe-flow.json + memory/), 부족 시 자가보고 폴백. 24h cache.",
    "path": ".claude/skills/onboard/SKILL.md",
    "invoke": "Skill(\"onboard\")",
    "meta": {
      "model": "claude-sonnet-4-6"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "orchestrate",
    "description": "Use when multiple independent tasks need coordinated delegation across agents with progress tracking.\n\"orchestrate\", \"오케스트레이션\", \"위임 모드\", \"에이전트 조율\", \"작업 분배\",\n\"병렬 위임\", \"멀티 에이전트\" 요청 시 사용.",
    "path": ".claude/skills/orchestrate/SKILL.md",
    "invoke": "Skill(\"orchestrate\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "pair",
    "description": "Builder(developer) + Validator(validator) 페어 프로그래밍 자동 오케스트레이션. /pair \"task\"로 호출하면 Claude가 단일 세션에서 developer → validator 루프를 자동 실행하고 최종 판정(approved/needs-revision)까지 보고한다.",
    "path": ".claude/skills/pair/SKILL.md",
    "invoke": "Skill(\"pair\")",
    "meta": {
      "effort": "high"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "perf-audit",
    "description": "Lighthouse CLI 래핑 — URL 성능 측정. Performance score + 5 Web Vitals (FCP/LCP/CLS/TBT/Speed Index) 추출, pass/warn/fail 판정, events.jsonl 이력 저장. on-demand only (~30s).",
    "path": ".claude/skills/perf-audit/SKILL.md",
    "invoke": "Skill(\"perf-audit\")",
    "meta": {
      "model": "claude-sonnet-4-6"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "performance-checker",
    "description": "\"성능 점검\", \"빌드 체크\", \"사이트 검증\", \"배포 전 점검\" 요청 시 사용.",
    "path": ".claude/skills/performance-checker/SKILL.md",
    "invoke": "Skill(\"performance-checker\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "plan",
    "description": "멀티스텝 작업의 계획을 파일로 작성/추적한다. brainstorm spec 또는 사용자 입력을 받아 planner 에이전트로 분석하고 .claude/plans/에 저장 후 단계별 진행 상태를 추적한다. 사용법 /plan \"<주제>\" | /plan from-brainstorm <파일> | /plan status [<plan-id>] | /plan complete <step-id>",
    "path": ".claude/skills/plan/SKILL.md",
    "invoke": "Skill(\"plan\")",
    "meta": {
      "effort": "medium"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "product-thinking",
    "description": "제품 기획 초기 컨셉 정립 — 호소다 다카히로 컨셉수업의 5 프레임워크(질문 설계 / 재구성 7가지 / 4C 스토리 / 경쟁 3층 / 팩트→베네핏)를 적용해 자유도와 임팩트가 높은 컨셉으로 좁힌다. \"제품 컨셉\", \"기능 기획 초기\", \"컨셉 잡기\", \"재구성\", \"경쟁 분석\", \"가치 제안 만들기\" 요청 시 사용.",
    "path": ".claude/skills/product-thinking/SKILL.md",
    "invoke": "Skill(\"product-thinking\")",
    "meta": {
      "effort": "small"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "receive-review",
    "description": "코드 리뷰 피드백을 항목별로 검증·분류·의사결정한다. performative agreement도 blind rejection도 금지 — 각 피드백을 카테고리(bug/security/performance/architecture/style/preference)로 분류 후 증거 기반으로 accept/reject/clarify 판정. 사용법 /receive-review [<source>]",
    "path": ".claude/skills/receive-review/SKILL.md",
    "invoke": "Skill(\"receive-review\")",
    "meta": {
      "effort": "high"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "release",
    "description": "릴리즈 — conventional commits에서 semver 자동 판단, CHANGELOG.md 갱신, git tag + push. /release [version]",
    "path": ".claude/skills/release/SKILL.md",
    "invoke": "Skill(\"release\")",
    "meta": {
      "effort": "medium"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "remotion-studio",
    "description": "입력 소스(이미지, 코드, 데이터)를 역동적인 Remotion 영상으로 변환하고 성공작을 템플릿으로 축적. 트리거: 'remotion 영상', '영상 만들어줘', '영상 템플릿', '동영상 만들어줘', 'remotion studio', '이 이미지로 영상', '이 코드로 영상'.",
    "path": ".claude/skills/remotion-studio/SKILL.md",
    "invoke": "Skill(\"remotion-studio\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "retro",
    "description": "프로젝트 회고 생성. 세션 노트 + git log 기반으로 지식을 공통/프로젝트별로 분류하여 아카이브. \"회고\", \"retro\", \"/retro\" 요청 시 사용.",
    "path": ".claude/skills/retro/SKILL.md",
    "invoke": "Skill(\"retro\")",
    "meta": {
      "allowed-tools": "Bash(git log:*), Bash(git diff:*), Bash(basename:*), Read, Write, Edit, Glob, Grep"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "retrospective",
    "description": "메트릭과 세션 로그를 분석하여 프로젝트 개선안을 도출한다",
    "path": ".claude/skills/retrospective/SKILL.md",
    "invoke": "Skill(\"retrospective\")",
    "meta": {
      "effort": "medium"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "review-pr",
    "description": "GitHub PR을 코드 리뷰한다. 코드 품질, 보안, 테스트 커버리지를 점검한다. 사용법: /review-pr [pr-number]",
    "path": ".claude/skills/review-pr/SKILL.md",
    "invoke": "Skill(\"review-pr\")",
    "meta": {
      "effort": "high"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "scaffold",
    "description": "새 도메인의 보일러플레이트 파일을 프로젝트 패턴에 맞게 자동 생성한다. 사용법: /scaffold [domain-name]",
    "path": ".claude/skills/scaffold/SKILL.md",
    "invoke": "Skill(\"scaffold\")",
    "meta": {
      "effort": "medium"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "security",
    "description": "OWASP Top 10 기준으로 프로젝트 전체 코드를 보안 스캔한다",
    "path": ".claude/skills/security/SKILL.md",
    "invoke": "Skill(\"security\")",
    "meta": {
      "effort": "high"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "security-audit",
    "description": "웹 애플리케이션 보안 감사 스킬. 3-Layer 구조(자동 스캔, 코드 리뷰, 아키텍처 리뷰)로 체계적 보안 점검 수행.\n\"보안 감사\", \"보안 점검\", \"security audit\", \"취약점 스캔\", \"OWASP 점검\", \"보안 리뷰\",\n\"XSS 점검\", \"SQLi 점검\", \"CSRF 점검\", \"인증 보안 검토\", \"권한 검토\" 요청 시 사용.\ndeploy-safety-guard(운영 안정성)와 구분: 이 스킬은 공격 벡터 관점의 보안 전문 감사.",
    "path": ".claude/skills/security-audit/SKILL.md",
    "invoke": "Skill(\"security-audit\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "seo-master",
    "description": "This skill should be used for Next.js App Router SEO optimization. Use when creating new pages, before deployment, or when the user requests \"SEO 점검\", \"메타태그 확인\", \"검색엔진 최적화\", \"시멘틱 HTML 점검\", \"접근성 점검\", \"GEO 점검\", \"AI 검색 최적화\", \"llms.txt\", \"AI 인용 최적화\", \"생성형 검색\".",
    "path": ".claude/skills/seo-master/SKILL.md",
    "invoke": "Skill(\"seo-master\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "site-auditor",
    "description": "This skill should be used for comprehensive site auditing that combines performance, design, SEO, backend safety, and security checks in one run. Use when the user requests \"전체 점검\", \"사이트 검증\", \"배포 전 종합 점검\", \"audit\", or wants to run all checks before deployment.",
    "path": ".claude/skills/site-auditor/SKILL.md",
    "invoke": "Skill(\"site-auditor\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "start-docs",
    "description": "This skill should be used when starting a new project to generate all planning documents at once. Use when the user requests \"프로젝트 시작\", \"기획 문서\", \"start-docs\", \"문서 생성\", or wants to create PRD, TRD, ERD, and other planning documents.",
    "path": ".claude/skills/start-docs/SKILL.md",
    "invoke": "Skill(\"start-docs\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "status",
    "description": "프로젝트 상태 대시보드 — git, CI, 배포 상태를 한눈에 보여준다",
    "path": ".claude/skills/status/SKILL.md",
    "invoke": "Skill(\"status\")",
    "meta": {
      "effort": "low"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "sync-claude-md",
    "description": "This skill should be used when the user requests \"sync\", \"동기화\", \"CLAUDE.md 업데이트\", \"오늘 정리\", \"세션 정리\", \"하루 마무리\", \"/sync\".",
    "path": ".claude/skills/sync-claude-md/SKILL.md",
    "invoke": "Skill(\"sync-claude-md\")",
    "meta": {
      "allowed-tools": "Bash(git log:*), Bash(git diff:*), Bash(git status:*), Bash(ls:*), Bash(wc:*), Read, Write, Edit, Glob, Grep"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "sync-workflow",
    "description": "Use when agent files or skills have been added, removed, or modified and you need to check if dev-workflow.md and MEMORY.md skills mapping are still accurate",
    "path": ".claude/skills/sync-workflow/SKILL.md",
    "invoke": "Skill(\"sync-workflow\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "telemetry",
    "description": "본인 1 머신 events.jsonl 분석 — Top 5 / Active / Stale / 개선 후보 / 추세. 기본 30일, --period 7|30|90 옵션으로 기간 조정. 4 모드 (all/skills/trends/--json).",
    "path": ".claude/skills/telemetry/SKILL.md",
    "invoke": "Skill(\"telemetry\")",
    "meta": {
      "model": "claude-sonnet-4-6"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "test",
    "description": "지정 파일에 대한 Vitest 단위 테스트를 자동 생성한다. 사용법: /test [file-path]",
    "path": ".claude/skills/test/SKILL.md",
    "invoke": "Skill(\"test\")",
    "meta": {
      "effort": "medium"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "verify",
    "description": "프로젝트 전체 검증 — lint, typecheck, unit test, E2E, 브라우저 콘솔 에러를 순차 실행한다",
    "path": ".claude/skills/verify/SKILL.md",
    "invoke": "Skill(\"verify\")",
    "meta": {
      "effort": "medium"
    },
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "web-design-guidelines",
    "description": "UI 코드 완성 후 접근성, 성능, UX 규칙 준수 여부를 검사하는 감사 도구. 100+ 규칙 기반으로 file:line 형식의 위반 보고서 생성. \"UI 검증\", \"접근성 검사\", \"코드 감사\", \"audit\", \"review my UI\", \"check accessibility\" 요청 시 사용.",
    "path": ".claude/skills/web-design-guidelines/SKILL.md",
    "invoke": "Skill(\"web-design-guidelines\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "webapp-testing",
    "description": "로컬 웹앱의 UI 동작을 확인하거나 Playwright로 화면·로그를 검증할 때 사용.",
    "path": ".claude/skills/webapp-testing/SKILL.md",
    "invoke": "Skill(\"webapp-testing\")",
    "meta": {},
    "toggleable": true
  },
  {
    "kind": "skill",
    "name": "worktree",
    "description": "Git worktree 기반 격리 작업 환경을 생성/관리한다. 대규모 기능 개발 시 메인 브랜치에 영향 없이 병렬 작업한다.",
    "path": ".claude/skills/worktree/SKILL.md",
    "invoke": "Skill(\"worktree\")",
    "meta": {
      "effort": "low"
    },
    "toggleable": true
  },
  {
    "kind": "agent",
    "name": "api-architect",
    "description": "API 설계 및 백엔드 아키텍처 전문 에이전트. REST/GraphQL API 설계, 라우팅, 미들웨어, 인증 흐름, 에러 핸들링을 담당한다.",
    "path": ".claude/agents/api-architect.md",
    "invoke": "Agent(subagent_type: \"api-architect\")",
    "meta": {
      "model": "opus",
      "tools": "Read, Edit, Write, Bash, Grep, Glob"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "architecture-reviewer",
    "description": "아키텍처 패턴, 기술부채, 코드 구조 전문 리뷰 에이전트. 리팩토링 제안, 패턴 일관성 검증, 기술부채 정량 평가를 담당한다.",
    "path": ".claude/agents/architecture-reviewer.md",
    "invoke": "Agent(subagent_type: \"architecture-reviewer\")",
    "meta": {
      "model": "sonnet",
      "tools": "Read, Grep, Glob, Bash"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "comparator",
    "description": "두 출력을 익명 블라인드 비교하여 품질 우열을 판정하는 에이전트",
    "path": ".claude/agents/comparator.md",
    "invoke": "Agent(subagent_type: \"comparator\")",
    "meta": {
      "model": "opus",
      "tools": "Read, Grep, Glob",
      "effort": "medium",
      "maxTurns": "10"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "designer",
    "description": "UI/UX 컴포넌트 설계 및 Tailwind CSS 스타일링 전문 에이전트. 참고 URL/캡처 이미지/로컬 파일(design-ref/) 기반 또는 자율 설계를 수행한다.",
    "path": ".claude/agents/designer.md",
    "invoke": "Agent(subagent_type: \"designer\")",
    "meta": {
      "model": "opus",
      "tools": "Read, Grep, Glob, Skill",
      "effort": "high",
      "maxTurns": "25",
      "memory": "project"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "developer",
    "description": "코드 구현 전문 에이전트. Server Actions, React 컴포넌트, zod 스키마 등을 프로젝트 패턴에 맞게 구현한다.",
    "path": ".claude/agents/developer.md",
    "invoke": "Agent(subagent_type: \"developer\")",
    "meta": {
      "model": "opus",
      "tools": "Read, Grep, Glob, Bash, Edit, Write",
      "effort": "high",
      "maxTurns": "30",
      "memory": "project"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "devops-engineer",
    "description": "인프라 구축 및 CI/CD 파이프라인 전문 에이전트. Docker, 클라우드 인프라, IaC, 배포 자동화를 담당한다.",
    "path": ".claude/agents/devops-engineer.md",
    "invoke": "Agent(subagent_type: \"devops-engineer\")",
    "meta": {
      "model": "sonnet",
      "tools": "Read, Edit, Write, Bash, Grep, Glob"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "feedback",
    "description": "코드 품질 분석 및 개선 제안 에이전트. 복잡도, 가독성, 성능, 규칙 준수 여부를 평가한다.",
    "path": ".claude/agents/feedback.md",
    "invoke": "Agent(subagent_type: \"feedback\")",
    "meta": {
      "model": "opus",
      "tools": "Read, Grep, Glob, Bash",
      "effort": "high",
      "maxTurns": "15"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "frontend-design-specialist",
    "description": "프론트엔드 UI 디자인 및 구현 전문 에이전트. 독창적이고 프로덕션급 인터페이스를 생성하며, AI slop을 방지하고 접근성 규칙 100+를 자동 적용한다.",
    "path": ".claude/agents/frontend-design-specialist.md",
    "invoke": "Agent(subagent_type: \"frontend-design-specialist\")",
    "meta": {
      "model": "sonnet",
      "tools": "Read, Edit, Write, Bash, Grep, Glob"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "grader",
    "description": "스킬 eval 결과를 기대치와 비교하여 PASS/FAIL을 판정하는 평가 에이전트",
    "path": ".claude/agents/grader.md",
    "invoke": "Agent(subagent_type: \"grader\")",
    "meta": {
      "model": "opus",
      "tools": "Read, Grep, Glob",
      "effort": "medium",
      "maxTurns": "10"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "moderator",
    "description": "에이전트 간 토론을 관리하고 합의를 도출하는 중재 에이전트",
    "path": ".claude/agents/moderator.md",
    "invoke": "Agent(subagent_type: \"moderator\")",
    "meta": {
      "model": "opus",
      "tools": "Read, Grep, Glob, Bash",
      "effort": "high",
      "maxTurns": "20"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "performance-optimizer",
    "description": "성능 최적화 전문 에이전트. 번들 크기, 렌더링 성능, DB 쿼리 최적화, 캐싱, Core Web Vitals를 담당한다.",
    "path": ".claude/agents/performance-optimizer.md",
    "invoke": "Agent(subagent_type: \"performance-optimizer\")",
    "meta": {
      "model": "sonnet",
      "tools": "Read, Grep, Glob, Bash"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "planner",
    "description": "작업 분석, 설계 문서 작성, 파일 영향도 판단, bite-sized 태스크 분해 전문 에이전트. 모든 구현의 설계를 선행한다.",
    "path": ".claude/agents/planner.md",
    "invoke": "Agent(subagent_type: \"planner\")",
    "meta": {
      "model": "opus",
      "tools": "Read, Grep, Glob, Agent",
      "effort": "max",
      "maxTurns": "20",
      "memory": "project"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "product-strategist",
    "description": "제품 전략 및 사용자 경험 전문 에이전트. 사용자 경험, 비즈니스 임팩트, MVP 스코프, 기능 우선순위를 담당한다.",
    "path": ".claude/agents/product-strategist.md",
    "invoke": "Agent(subagent_type: \"product-strategist\")",
    "meta": {
      "model": "sonnet",
      "tools": "Read, Grep, Glob, Bash, WebSearch, WebFetch"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "project-planner",
    "description": "프로젝트 요구사항 공학 및 기획 전문 에이전트. PRD/TRD/ERD 생성, 모호성 해소, 스코프 정의를 담당한다.",
    "path": ".claude/agents/project-planner.md",
    "invoke": "Agent(subagent_type: \"project-planner\")",
    "meta": {
      "model": "sonnet",
      "tools": "Read, Write, Grep, Glob, Bash, WebSearch, WebFetch"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "qa",
    "description": "TDD 사이클 주도 및 테스트 전문 에이전트. RED-GREEN-REFACTOR 프로세스를 강제하고, Vitest/Playwright 테스트를 담당한다.",
    "path": ".claude/agents/qa.md",
    "invoke": "Agent(subagent_type: \"qa\")",
    "meta": {
      "model": "opus",
      "tools": "Read, Grep, Glob, Bash, Edit, Write, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_fill_form, mcp__playwright__browser_console_messages, mcp__playwright__browser_take_screenshot",
      "effort": "high",
      "maxTurns": "30",
      "memory": "project"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "retrospective",
    "description": "프로젝트 이력을 분석하여 에이전트/스킬/규칙 개선안을 도출하는 학습 에이전트. 메트릭과 세션 로그를 종합 분석한다.",
    "path": ".claude/agents/retrospective.md",
    "invoke": "Agent(subagent_type: \"retrospective\")",
    "meta": {
      "model": "opus",
      "tools": "Read, Grep, Glob, Bash",
      "effort": "high",
      "maxTurns": "15",
      "memory": "project"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "security-specialist",
    "description": "보안 전문 에이전트. 보안 취약점 분석, 인증/인가, OWASP Top 10, 입력 검증, 데이터 보호를 담당한다.",
    "path": ".claude/agents/security-specialist.md",
    "invoke": "Agent(subagent_type: \"security-specialist\")",
    "meta": {
      "model": "opus",
      "tools": "Read, Grep, Glob, Bash"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "security",
    "description": "보안 취약점 점검 전문 에이전트. OWASP Top 10 기준으로 코드를 스캔하고 취약점을 보고한다.",
    "path": ".claude/agents/security.md",
    "invoke": "Agent(subagent_type: \"security\")",
    "meta": {
      "model": "opus",
      "tools": "Read, Grep, Glob",
      "effort": "high",
      "maxTurns": "20"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "skill-reviewer",
    "description": "스킬 품질을 8단계로 검토하고 100점 만점 스코어카드를 출력하는 검증 에이전트",
    "path": ".claude/agents/skill-reviewer.md",
    "invoke": "Agent(subagent_type: \"skill-reviewer\")",
    "meta": {
      "model": "opus",
      "tools": "Read, Grep, Glob",
      "effort": "medium",
      "maxTurns": "10"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "supabase-db-specialist",
    "description": "Supabase/PostgreSQL 데이터베이스 전문 에이전트. 스키마 설계, 쿼리 최적화, RLS 정책, 인덱스 관리, 마이그레이션을 담당한다.",
    "path": ".claude/agents/supabase-db-specialist.md",
    "invoke": "Agent(subagent_type: \"supabase-db-specialist\")",
    "meta": {
      "model": "opus",
      "tools": "Read, Edit, Write, Bash, Grep, Glob"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "technical-writer",
    "description": "기술 문서 작성 전문 에이전트. API 문서, README, 체인지로그, 트러블슈팅 가이드, 개발자 경험(DX) 최적화를 담당한다.",
    "path": ".claude/agents/technical-writer.md",
    "invoke": "Agent(subagent_type: \"technical-writer\")",
    "meta": {
      "model": "haiku",
      "tools": "Read, Write, Grep, Glob"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "test-writer",
    "description": "테스트 코드 작성 전문 에이전트. TDD 워크플로우(Red-Green-Refactor), 단위/통합/E2E 테스트를 체계적으로 작성한다.",
    "path": ".claude/agents/test-writer.md",
    "invoke": "Agent(subagent_type: \"test-writer\")",
    "meta": {
      "model": "sonnet",
      "tools": "Read, Edit, Write, Bash, Grep, Glob"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "ux-researcher",
    "description": "사용자 경험 연구 및 사용성 분석 전문 에이전트. 페르소나, 유저 플로우, 휴리스틱 평가, 사용성 테스트 설계를 담당한다.",
    "path": ".claude/agents/ux-researcher.md",
    "invoke": "Agent(subagent_type: \"ux-researcher\")",
    "meta": {
      "model": "sonnet",
      "tools": "Read, Write, Grep, Glob, Bash, WebSearch, WebFetch"
    },
    "toggleable": false
  },
  {
    "kind": "agent",
    "name": "validator",
    "description": "Builder의 완료 작업을 fresh-context로 검증하는 pair mode 전용 품질 게이트. Binary 판정(approved/needs-revision) 출력.",
    "path": ".claude/agents/validator.md",
    "invoke": "Agent(subagent_type: \"validator\")",
    "meta": {
      "model": "opus",
      "tools": "Read, Grep, Glob, Bash",
      "effort": "high",
      "maxTurns": "12",
      "memory": "project"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "_common",
    "description": "크로스 플랫폼 공유 유틸리티",
    "path": ".claude/hooks/_common.sh",
    "invoke": null,
    "meta": {},
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "auto-build-safety",
    "description": "PreToolUse 안전 hook for /auto-build 자율 사이클",
    "path": ".claude/hooks/auto-build-safety.sh",
    "invoke": null,
    "meta": {
      "event": "PreToolUse"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "budget-warn",
    "description": "Notification hook",
    "path": ".claude/hooks/budget-warn.sh",
    "invoke": null,
    "meta": {
      "event": "Notification"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "command-guard",
    "description": "PreToolUse hook — blocks dangerous Bash commands",
    "path": ".claude/hooks/command-guard.sh",
    "invoke": null,
    "meta": {
      "event": "PreToolUse"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "context-prune",
    "description": "PreCompact 훅: 컨텍스트 압축 전 도구 출력 요약",
    "path": ".claude/hooks/context-prune.sh",
    "invoke": null,
    "meta": {
      "event": "PreCompact"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "debate-trigger",
    "description": "PostToolUse hook",
    "path": ".claude/hooks/debate-trigger.sh",
    "invoke": null,
    "meta": {
      "event": "PostToolUse"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "design-lint",
    "description": "PostToolUse prompt 훅",
    "path": ".claude/hooks/design-lint.sh",
    "invoke": null,
    "meta": {
      "event": "PostToolUse"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "eslint-fix",
    "description": "ESLint auto-fix hook - PostToolUse (Edit/Write)",
    "path": ".claude/hooks/eslint-fix.sh",
    "invoke": null,
    "meta": {
      "event": "PostToolUse"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "git-post-commit",
    "description": "git post-commit hook — emit commit_pushed event to .claude/events.jsonl",
    "path": ".claude/hooks/git-post-commit.sh",
    "invoke": null,
    "meta": {},
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "message-bus",
    "description": "에이전트 간 메시지 버스",
    "path": ".claude/hooks/message-bus.sh",
    "invoke": null,
    "meta": {},
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "metrics-collector",
    "description": "PostToolUse hook: 메트릭 수집",
    "path": ".claude/hooks/metrics-collector.sh",
    "invoke": null,
    "meta": {
      "event": "PostToolUse"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "model-suggest",
    "description": "Notification 훅: 스마트 모델 라우팅 제안",
    "path": ".claude/hooks/model-suggest.sh",
    "invoke": null,
    "meta": {
      "event": "Notification"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "notify",
    "description": "Notification hook: Claude가 사용자 입력을 기다릴 때 데스크톱 알림 전송",
    "path": ".claude/hooks/notify.sh",
    "invoke": null,
    "meta": {
      "event": "Notification"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "pattern-check",
    "description": "PostToolUse prompt 훅",
    "path": ".claude/hooks/pattern-check.sh",
    "invoke": null,
    "meta": {
      "event": "PostToolUse"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "pre-compact",
    "description": "PreCompact hook: 컨텍스트 압축 전 중요 정보를 보존한다.",
    "path": ".claude/hooks/pre-compact.sh",
    "invoke": null,
    "meta": {
      "event": "PreCompact"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "prettier-format",
    "description": "Recursion guard — prettier가 파일을 다시 쓰면 PostToolUse가 재트리거될 수 있음",
    "path": ".claude/hooks/prettier-format.sh",
    "invoke": null,
    "meta": {
      "event": "PostToolUse"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "readme-sync",
    "description": "PostToolUse hook: README/아키텍처 수치 자동 동기화",
    "path": ".claude/hooks/readme-sync.sh",
    "invoke": null,
    "meta": {
      "event": "PostToolUse"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "security-lint",
    "description": "PostToolUse Write/Edit 후 OWASP 정적 패턴 검증",
    "path": ".claude/hooks/security-lint.sh",
    "invoke": null,
    "meta": {
      "event": "PostToolUse"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "session-log",
    "description": "Stop hook: 세션 종료 시 작업 기록 저장 + 메트릭 요약",
    "path": ".claude/hooks/session-log.sh",
    "invoke": null,
    "meta": {
      "event": "Stop"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "session-memory-sync",
    "description": "Stop hook",
    "path": ".claude/hooks/session-memory-sync.sh",
    "invoke": null,
    "meta": {
      "event": "Stop"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "session-review",
    "description": "Stop prompt 훅",
    "path": ".claude/hooks/session-review.sh",
    "invoke": null,
    "meta": {
      "event": "Stop"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "skill-tracker",
    "description": "UserPromptSubmit hook: prompt 첫 단어가 /<skill_name>이면 events.jsonl에 skill_invoked 이벤트 push.",
    "path": ".claude/hooks/skill-tracker.sh",
    "invoke": null,
    "meta": {
      "event": "UserPromptSubmit"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "smart-guard",
    "description": "PreToolUse prompt 훅 래퍼",
    "path": ".claude/hooks/smart-guard.sh",
    "invoke": null,
    "meta": {
      "event": "PreToolUse"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "tdd-enforce",
    "description": "PreToolUse (Write|Edit) — TDD 규칙 강제화",
    "path": ".claude/hooks/tdd-enforce.sh",
    "invoke": null,
    "meta": {
      "event": "PreToolUse"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "test-runner",
    "description": "Related test auto-runner hook - PostToolUse (Edit/Write)",
    "path": ".claude/hooks/test-runner.sh",
    "invoke": null,
    "meta": {
      "event": "PostToolUse"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "tool-failure-handler",
    "description": "PostToolUseFailure hook: 도구 실행 실패 시 구조화된 에러 분류 + 복구 힌트",
    "path": ".claude/hooks/tool-failure-handler.sh",
    "invoke": null,
    "meta": {
      "event": "PostToolUseFailure"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "typecheck",
    "description": "TypeScript type check hook - PostToolUse (Edit/Write)",
    "path": ".claude/hooks/typecheck.sh",
    "invoke": null,
    "meta": {
      "event": "PostToolUse"
    },
    "toggleable": false
  },
  {
    "kind": "hook",
    "name": "uncommitted-warn",
    "description": "Stop hook: 커밋 안 한 변경사항이 있으면 경고",
    "path": ".claude/hooks/uncommitted-warn.sh",
    "invoke": null,
    "meta": {
      "event": "Stop"
    },
    "toggleable": false
  },
  {
    "kind": "rule",
    "name": "conventions",
    "description": "모든 코드 변경 전에 설계/계획이 선행되어야 한다. \"간단한 변경\"도 예외 없음. 순서: **설계 → TDD(테스트 작성 → 구현) → 검증**. `rules/tdd.md`의 RED-GREEN-REFACTOR는 설계 완료 후 적용.",
    "path": ".claude/rules/conventions.md",
    "invoke": null,
    "meta": {
      "paths": "src/**/*.ts, src/**/*.tsx, src/**/*.js, src/**/*.jsx"
    },
    "toggleable": false
  },
  {
    "kind": "rule",
    "name": "debugging",
    "description": "에러가 발생하면 **찍어맞추기(guess-and-check)를 금지**한다. 반드시 4단계 프로세스를 따른다.",
    "path": ".claude/rules/debugging.md",
    "invoke": null,
    "meta": {},
    "toggleable": false
  },
  {
    "kind": "rule",
    "name": "design",
    "description": "- 프로젝트 디자인 토큰은 `src/lib/design-tokens.ts`에 중앙 관리 - TypeScript `as const` 객체로 정의하여 타입 안전성 확보 - `tailwind.config.ts`의 `theme.extend`에서 토큰 파일을 참조하여 확장 - 새 색상/간격/폰트 추가 시 토큰 파일에 먼저 정의, 그 후 컴포넌트에서 사용",
    "path": ".claude/rules/design.md",
    "invoke": null,
    "meta": {
      "paths": "src/**/*.tsx, src/**/*.jsx, src/**/*.css, src/**/*.scss, src/lib/design-tokens.ts, tailwind.config.*"
    },
    "toggleable": false
  },
  {
    "kind": "rule",
    "name": "donts",
    "description": "- `console.log` 남기지 않기 (디버깅 후 반드시 제거) - `any` 타입 사용 금지 (`unknown` + 타입 가드 사용) - `@ts-ignore`, `@ts-expect-error` 사용 금지 - `eslint-disable` 주석 금지 (규칙 자체를 수정하거나 코드를 고칠 것) - 미사용 import, 변수, 함수 남기지 않기",
    "path": ".claude/rules/donts.md",
    "invoke": null,
    "meta": {
      "paths": "src/**/*.ts, src/**/*.tsx, src/**/*.js, src/**/*.jsx, src/**/*.css"
    },
    "toggleable": false
  },
  {
    "kind": "rule",
    "name": "git",
    "description": "- 접두사 필수: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:` - 한국어 메시지 (접두사만 영어) - 제목 50자 이내, 본문은 선택",
    "path": ".claude/rules/git.md",
    "invoke": null,
    "meta": {},
    "toggleable": false
  },
  {
    "kind": "rule",
    "name": "karpathy-principles",
    "description": "Andrej Karpathy가 공개한 LLM 코딩의 흔한 함정 관찰에서 도출된 4 원칙. 본 파일은 4 원칙을 명시하고, **각 원칙이 vibe-flow의 어느 rules/skills와 매핑되는지** cross-link한다.",
    "path": ".claude/rules/karpathy-principles.md",
    "invoke": null,
    "meta": {},
    "toggleable": false
  },
  {
    "kind": "rule",
    "name": "tdd",
    "description": "**테스트를 먼저 쓰고, 실패를 확인한 뒤에만 구현 코드를 작성한다.**",
    "path": ".claude/rules/tdd.md",
    "invoke": null,
    "meta": {
      "paths": "src/**/*.ts, src/**/*.tsx, src/**/*.test.*, src/**/*.spec.*, tests/**/*, e2e/**/*"
    },
    "toggleable": false
  }
];
