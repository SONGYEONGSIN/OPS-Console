# 팀 보고 브리핑 자동화 — 스펙 (구현 완료)

> 상태: **구현 완료** (2026-07-01) — 코드/테스트/레지스트리 반영. 운영 전환(cron-job.org 등록 + Teams env)만 남음.
> 결정: 일정 = **다음주 월~금(평일)**, 마감 임박 window = **7일**, 드라이런 = `TEAM_BRIEFING_DRY_RUN` 또는 `MAIL_DRY_RUN`.
> 구현: `jobs/team-briefing-build.ts`(순수 집계·HTML) + `jobs/team-briefing.ts`(`runTeamBriefing`) + `registry.ts` 등록(id `team-briefing`).

## 목적

매주 **금요일** Teams 그룹채팅으로 "팀 보고 브리핑"을 자동 발송. 시스템이 현황 데이터를 집계해 스냅샷 형태로 공유.

## 스코프 (확정된 2개 섹션)

### 1. 계약진행 현황
- 소스: `listContracts()` — `src/features/contracts/queries.ts` (SharePoint Excel, `SHAREPOINT_CONTRACTS_ITEM_ID`)
- 시트 구분: `contractSheetEnum` = **4년제 / 전문대 / 초중고 / 대학원 / 기타** (5시트)
- 행 필드: `sheet`, `status`(계약진행현황 열 — `"계약완료"` 또는 공란), `serviceActive`(서비스여부 열 — `"Y"` 또는 공란)
- 집계: **시트별 × (계약완료 / 진행중)** 카운트 + 합계. (진행중 = status가 "계약완료"가 아닌 행)

### 2. 팀업무 현황
- **일정**: `listScheduleEvents()` — `src/features/schedule/queries.ts`. 유형 7종(`shift/event/leave/training/application/pims/external_meeting`), 필드 `type/start_at/end_at/title/all_day/assignee_email`. → 이번주(또는 다음주) 범위를 카테고리별로 그룹.
- **서비스 마감 임박**: `services.write_start_at` 기준. ⚠️ 기존 `listUpcomingForOperator(email, windowDays)`는 **본인 담당만** 반환 → 팀 전체용은 **신규 team-wide 쿼리** 또는 services를 `write_start_at ∈ [today, today+N]`로 직접 필터 필요.

## 발송 인프라 (준비됨)

- 함수: `sendTeamsChatMessage({ operatorEmail, chatId, html })` — `src/lib/microsoft/teams.ts`
- 인증: **delegated token** (`Chat.ReadWrite`, `offline_access`). Application 토큰 불가 → Azure 앱 관리자 동의 필요.
- env: `TEAMS_CHAT_ID`(그룹채팅 ID) + 발송 명의 이메일. 미설정 시 발송 생략.
- 메시지 body: HTML contentType. 제목 볼드 + 섹션별 현황 HTML (기존 `buildNoticeMessage` 패턴 확장).
- 참고 구현: `src/features/automations/jobs/notice-teams-share.ts` (멱등성 패턴)

## 자동화 잡 등록 (2단계)

1. `src/features/automations/registry.ts` `AUTOMATION_JOBS` 배열에 1객체 추가:
   `{ id, label, description, scheduleInfo, cooldownMinutes, run: runTeamBriefing }`
2. `src/features/automations/jobs/{id}.ts` 생성: `export async function runTeamBriefing(): Promise<AutomationRunResult>`

- cron 진입점: `/api/automations/run?jobId={id}` (cron-job.org). scheduleInfo에 "매주 금요일 ..." 명시.
- 드라이런: 기존 잡들처럼 `MAIL_DRY_RUN`/전용 플래그로 외부 호출 없이 이력만.

## 주의

- **기존 `weekly-report-rollover` 잡과 구분** — 그건 *사람이 쓰는* 주간업무보고서 Teams 공유(발신 순환: 임형섭→전성대→허승철). 이 브리핑은 *시스템이 뽑는* 현황 스냅샷. 주기(금요일) 겹치면 혼동 주의.

## 이번에 미채택 (다음 확장 후보)

미수채권(경과 10일+ 임박·담당자별) / 인시던트(미처리·부서별) / 인수인계 진행 / 백업요청 대기 / 메일함 회신 필요.

## 구현 체크리스트

- [x] team-wide 마감 임박 — 잡에서 admin client로 `services` 직접 필터(write_start_at D-7, cron-safe)
- [x] 집계·메시지 빌더 순수 함수 + 단위 테스트 (TDD) — `team-briefing-build.ts` (계약집계/다음주 평일범위/일정그룹/HTML)
- [x] `jobs/team-briefing.ts` `runTeamBriefing()` — 계약(SharePoint)/일정·마감(admin) fetch → HTML 조립 → `sendTeamsChatMessage`
- [x] `registry.ts` 등록 (id `team-briefing`, scheduleInfo "매주 금요일")
- [x] 드라이런 플래그(`TEAM_BRIEFING_DRY_RUN`/`MAIL_DRY_RUN`) + 이력(runner가 automation_runs 적재)
- [ ] 로컬 `/api/automations/run?jobId=team-briefing` 드라이런 확인 (운영)
- [ ] Teams env(`TEAMS_CHAT_ID`/`TEAMS_BRIEFING_SENDER`) + cron-job.org 매주 금요일 등록 (운영 전환)
