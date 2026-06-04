---
plan_id: 20260605-weekly-report-rollover
status: in_progress
created: 2026-06-05
hard_gate: full
source: docs/buseobogo.py 분석 + 사용자 결정(주간보고 우선, Teams 포함)
---

# Plan: 본부차주보고 알림 (주간 업무보고서 차주 롤오버 + Teams 공유)

## Goal
`docs/buseobogo.py`를 OPS-Console 자동화 잡으로 이식. SharePoint의 직전 주차
주간업무보고서 xlsx를 차주로 롤오버(파일 복제 + 시트/셀 갱신)하고, 공유 링크를
Teams 그룹채팅에 발송한다. 자동화 메뉴(`/dashboard/automations`)에 등록 + cron.

## 아키텍처 결정
- 서버리스(Vercel) 잡. 브라우저 불필요 — 전부 Graph REST.
- openpyxl 셀 수동복사 → **Graph workbook API**(시트 copy + range PATCH)로 대체(서식 보존).
- SharePoint = app-only(`getGraphToken`). **Teams 전송 = 위임 토큰(`getDelegatedGraphToken`)**
  — app-only로는 `chats/{id}/messages` 불가. DELEGATED_SCOPE에 `Chat.ReadWrite` 추가 필요.
- `MAIL_DRY_RUN`/전용 dry-run 가드로 Teams 미동의 상태에서도 안전 적재.

## 순수 로직(검증 가능 — Phase 1, TDD 필수)
`jobs/weekly-report/rollover-logic.ts`:
- `pyWeekday(date)` — Python weekday(월=0) 정규화 `(getDay()+6)%7`
- `floorMod(a,b)` — Python `%`(음수 floor) 재현 (`((a%b)+b)%b`)
- `isoMonthWeeksCount(year, month)` — 목요일 규칙 월별 주차수
- `nextWeekFilename(name)` — `(주간업무보고서_진학어플라이본부)_(YYYY)_(M)월(N)주차(.xlsx)`
  파싱 → 주차+1, 초과 시 월/년 캐리(zero-pad 없음)
- `nextWeekSheetname(name)` — `YYYY년 M월 N주차` 동일 롤오버
- `weekDateRange(year, month, week)` → `{ monday, friday }` (목요일-3 / +1)
- `formatDateRange(start, end)` → `"M/D~M/D"` (zero-pad 없음)
- `senderForWeek(year, month, week)` — 앵커 2026-01, `floorMod(2+누적주차,3)`,
  `["임형섭 부장님","전성대 부장님","허승철 부장님"]`. **개선**: 연도 경계 넘어도
  앵커(2026-01 5주차=임형섭[0]) 연속성 유지하도록 누적합을 연도 교차로 일반화.
- 셀 치환: `subWeekText`(B2: `YYYY년\s*M월\s*N주차` → new sheetname),
  `subDateRange`(B3/H3: `\d+/\d+~\d+/\d+` → new range)

## Graph 오케스트레이션 (Phase 2)
`jobs/weekly-report/index.ts` (run):
1. drive/folder 식별 — 후보 경로 폴백(General/General, 주간업무보고서_진학어플라이본부 …).
   **확인 필요**: 주간보고가 receivables drive와 같은 SHAREPOINT_DRIVE_ID인지, 폴더 경로.
2. 최신 보고 파일(`주간업무보고서_진학어플라이본부` prefix, lastModifiedDateTime max) 조회.
3. 차주 파일이 이미 있으면 skip(멱등).
4. 원본 복사(Graph copy 또는 download→PUT new name).
5. 워크북 세션 → 최신 시트 copy → 차주 시트 rename → B2/B3/H3 PATCH(전주 H3→차주 B3, 현재+7→H3).
6. 공유 링크(permissions 재사용 / createLink type=view scope=organization).
7. Teams 메시지(HTML 템플릿) → `getDelegatedGraphToken` → `POST /chats/{TEAMS_CHAT_ID}/messages`.
8. 이력 적재 + dry-run 가드.

## 신규 모듈/변경
- `jobs/weekly-report/rollover-logic.ts` (+ `__tests__`) — Phase 1
- `jobs/weekly-report/index.ts` — Phase 2 run()
- `lib/microsoft/teams.ts` — `sendTeamsChatMessage(chatId, html)` (위임 토큰)
- `lib/microsoft/delegated-token.ts` — DELEGATED_SCOPE에 `Chat.ReadWrite` 추가
- `lib/microsoft/workbook-session.ts` — 시트 copy/range PATCH 헬퍼(필요 시 보강)
- `features/automations/registry.ts` — 1줄 등록 (id `weekly-report-rollover`, label "본부차주보고 알림")
- `.github/workflows/weekly-report-rollover.yml` — 주 1회 cron
- `.env.local` — `TEAMS_CHAT_ID` 신규 (값=사용자 제공)
- migration: `automation_settings` 행(있으면) — 기존 패턴 따름

## 선결 조건 (사용자/Azure)
1. **TEAMS_CHAT_ID** 값 — Teams 그룹채팅 ID.
2. **Azure 앱에 위임 권한 `Chat.ReadWrite` + 관리자 동의**, 운영자 위임 토큰 재인증.
3. 주간보고 SharePoint **drive/폴더 경로** 확정.
4. 발송자 순환 앵커(2026-01 5주차=임형섭) 현 운영과 일치 확인.

## 단계
- T1: 순수 로직 + TDD (RED→GREEN) — **본 단계 즉시**
- T2: teams.ts + delegated scope
- T3: Graph 오케스트레이션 run()
- T4: registry 등록 + cron yml + env
- T5: 통합 검증/PR
