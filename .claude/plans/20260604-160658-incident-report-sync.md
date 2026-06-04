---
plan_id: 20260604-160658-incident-report-sync
status: in_progress
created: 2026-06-04T07:06:58Z
hard_gate: full
source: user-direct (라이브 피드백 5건 + 양방향 동기화 결정)
---

# Plan: 사고↔경위서 양방향 동기화 + 경위서 UX 수정

## Goal
사고(incident)를 공유 필드의 **단일 소스**로 삼아, 사고 폼과 경위서 탭 어디서 수정해도 자동 동기화(divergence 없음). 경위서 승인 시 그 시점 내용을 스냅샷으로 동결. 더불어 라이브 피드백 5건의 UX/버그 수정.

## Approach
- **단일 소스**: 공유 필드(경위=cause_summary, 원인=root_cause, 처리=handling_rows+legacy resolution, 대책=prevention, 수신대학=university_name, 서비스명=service_name)는 incidents 테이블이 소유.
  - 경위서 탭(draft/rejected)의 경위/원인/처리/대책 편집 → `updateIncident`로 사고에 기록(양방향). 수신대학/서비스명은 경위서에서 읽기전용.
  - 경위서 고유 필드(제목/사과문/시행번호/결재) → 경위서가 소유, 경위서에서만 편집.
- **승인 시 동결**: approveIncidentReport 시 사고의 공유 필드를 경위서 스냅샷 컬럼으로 복사. 승인된 경위서는 스냅샷 표시(사고 수정 영향 없음).
- **행기반 처리 편집기 공유 컴포넌트화**: ReportEditorWorkspace의 처리 행 편집 UI를 `HandlingRowsEditor`로 추출 → 사고 EditForm·경위서 양쪽 재사용. 내용 칸 textarea(줄바꿈).
- 선행 quick fix(PDF 위치, 서비스명 드롭다운 버그)는 동기화와 독립 → 먼저 별도 PR.

## Out of Scope
- 사고/경위서 외 다른 도메인.
- 승인 후 경위서 재편집(동결 유지 — 승인 취소 시 기존 흐름).
- 필드 명칭 통일 리네이밍(매핑 레이어로 흡수).

## 영향 파일 (개략)
- 마이그: `supabase/migrations/2026xxxx_incidents_handling_rows.sql`, `..._incident_reports_service_name.sql`
- incidents: `schemas.ts`, `actions.ts`, `queries.ts`, EditForm/View/Table, `_row-mapper.ts`, ListPattern row 타입
- incident-reports: `schemas.ts`, `actions.ts`, `queries.ts`, `form-content.ts`, `page.tsx`, `ReportEditorWorkspace.tsx`, `FormPage.tsx`
- 공유: `HandlingRowsEditor.tsx`(신규) + 테스트
- `globals.css`/없음

## 단계

### PR-A — 선행 quick fix (동기화 무관)

#### T1: PDF 버튼 → 공문 뷰어 컬럼 우상단 (항목4)
- **상태**: pending
- **파일**: `incident-reports/[id]/page.tsx`, `ReportEditorWorkspace.tsx`, workspace 테스트
- **변경**: page.tsx 헤더에서 PDF 제거 → ReportEditorWorkspace 좌측 뷰어 컨테이너 우상단(absolute) 배치.
- **DoD**: 뷰어 영역 우상단에 PDF, 헤더엔 '← 사고 보고 목록'만. 워크스페이스 테스트에 PDF 링크 존재 단언 추가 GREEN.
- **의존**: 없음

#### T2: 서비스명 드롭다운 재표시 버그 (항목5a→5b)
- **상태**: pending
- **파일**: `incidents/EditForm.tsx` (+ 필요 시 actions/저장 검증), 테스트
- **변경**: 서비스명 자동완성 드롭다운에 명시적 open 상태 도입 — 선택 시 닫힘, 포커스/타이핑 시 열림. 저장 후 재진입 시 자동 표시 방지. service_name 저장 누락 여부 확인.
- **DoD**: 선택→저장→재편집 시 드롭다운 자동 표시 안 됨. service_name이 저장·표시(5b)됨. 가능 시 회귀 테스트.
- **의존**: 없음

#### T3: PR-A 검증/PR
- **상태**: pending
- **변경**: typecheck+lint+test, PR 생성.
- **의존**: T1,T2

### PR-B — 양방향 동기화 restructure

#### T4: 마이그레이션 (선적용)
- **상태**: pending
- **파일**: `incidents_handling_rows.sql`, `incident_reports_service_name.sql`
- **변경**: `incidents.handling_rows jsonb default '[]'`, `incident_reports.service_name text`. Supabase 선적용 + service_role 검증.
- **DoD**: 두 컬럼 service_role select 성공.
- **의존**: 없음

#### T5: HandlingRowsEditor 공유 컴포넌트 추출
- **상태**: pending
- **파일**: `_components/.../HandlingRowsEditor.tsx`(신규)+테스트, ReportEditorWorkspace 리팩토링
- **변경**: 처리 행(time/content) 편집 UI 추출. 내용 칸 textarea(줄바꿈, 항목2a). ReportEditorWorkspace가 이를 사용.
- **DoD**: 추출 후 경위서 처리 편집 동일 동작 + textarea 줄바꿈. 컴포넌트 단위 테스트.
- **의존**: 없음(마이그 무관)

#### T6: 사고 EditForm 행기반 처리 + handling_rows (항목2b)
- **상태**: pending
- **파일**: incidents `schemas.ts`/`actions.ts`/`queries.ts`/EditForm/View/`_row-mapper.ts`
- **변경**: incidents에 handling_rows 추가, EditForm에 HandlingRowsEditor 사용, View에 행 렌더. 저장/매핑.
- **DoD**: 사고 폼에서 처리 행 추가·저장·표시. 테스트.
- **의존**: T4, T5

#### T7: 경위서 ↔ 사고 양방향 배선
- **상태**: pending
- **파일**: incident-reports `page.tsx`/`ReportEditorWorkspace.tsx`/`actions.ts`/`form-content.ts`
- **변경**: 경위/원인/처리/대책/서비스명 사고에서 라이브 동기화(page.tsx). 경위서 편집 저장 시 공유 필드는 updateIncident, 고유 필드는 updateIncidentReport. 수신대학·서비스명 읽기전용(항목3a·3b).
- **DoD**: 경위서에서 경위~대책 수정 → 사고 반영. 사고 수정 → 경위서 반영. 수신대학·서비스명 비활성+표시. 테스트.
- **의존**: T4, T5, T6

#### T8: 승인 시 동결 스냅샷
- **상태**: pending
- **파일**: incident-reports `actions.ts`(approve), FormPage/Workspace 표시 분기
- **변경**: 승인 시 사고 공유 필드 → 경위서 스냅샷 컬럼 복사. 승인된 경위서는 스냅샷 표시(라이브 동기화 중단).
- **DoD**: 승인 후 사고 수정해도 승인 경위서 불변. 테스트.
- **의존**: T7

#### T9: PR-B 통합 검증/PR
- **상태**: pending
- **변경**: 전체 test+typecheck+lint+build, 마이그 검증 재확인, PR.
- **의존**: T4~T8

## 리스크
- **승인 동결 경계**: draft=라이브, approved=스냅샷. 상태 전환 시 일관성 — 테스트로 보장.
- **마이그 선적용 누락 시 런타임 실패**(column does not exist) — T4 검증 게이트.
- **공유 필드 명칭 불일치**(incident.cause_summary ↔ report 경위) — 매핑 레이어 단일화.
- **처리 행 추출 회귀** — 경위서 기존 동작 보존 테스트.

## 진행 추적
| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-06-04T07:06:58Z | - | plan 생성 | 라이브 피드백 5건 + 양방향 동기화 결정(사용자 승인) |
| 2026-06-04 | T1·T2·T3 | done | PR-A #326 머지 (PDF 위치·서비스명 저장) |
| 2026-06-04 | T4 | 작성 | 마이그 2건 — **Supabase 적용 대기** |
| 2026-06-04 | T5 | done | HandlingRowsEditor 공유 추출 + textarea(항목2a) |
| 2026-06-04 | T6 | done | 사고 행기반 처리(항목2b) + handling_rows |
| 2026-06-04 | 마이그 | 적용됨 | service_role 2/2 검증 (incidents.handling_rows, incident_reports.service_name) |
| 2026-06-04 | T7a | done | 수신대학 읽기전용(3a) + 서비스명 표시(3b) |
| 2026-06-04 | T7b·T8 | 대기 | item1 양방향 저장 + 승인 동결 (체크포인트 — 다음) |
| 2026-06-04 | PR-B | 머지 | #327 머지 (2a·2b·3a·3b + 마이그). **item1·동결은 follow-up으로 보류** |

## 남은 follow-up (item 1 + 동결) — 재개 가이드
- **item 1 (양방향 저장)**: ReportEditorWorkspace.onSave를 분리 — 공유 필드(경위→cause_summary/원인→root_cause/처리→handling_rows/대책→prevention)는 `updateIncident(report.incident_id, ...)`로, 고유 필드(제목/사과문)는 `updateIncidentReport`로. page.tsx는 draft/rejected일 때 incident에서 gyeongwi/cause/handling_rows/prevention 라이브 override(현재 university_name·service_name만). updateIncident import 추가.
- **T8 동결**: approveIncidentReport에서 사고 공유 필드를 경위서 컬럼(recipient_university/service_name/gyeongwi/cause/handling_rows/prevention)에 스냅샷 복사. page.tsx는 approved일 때 report 스냅샷 사용(라이브 override 끔).
- 테스트 재작업: workspace 저장 테스트(현재 updateIncidentReport 단일 호출 가정) → updateIncident+updateIncidentReport 분리 가정으로. fixture incident_id를 non-null로.
