---
plan_id: 20260525-200649-reports-full-features
status: in_progress
created: 2026-05-25T20:06:49+09:00
hard_gate: full
source: brainstorm:.claude/memory/brainstorms/20260525-193412-reports-menu.md (extended)
---

# Plan: 분석보고서 전체 기능 — DB 저장 + 상세 + PDF + 외부 공유

## Goal

`/dashboard/reports` 의 저장된 리포트 placeholder를 **실제 동작 기능**으로 전환.
- 운영자가 KPI 스냅샷을 리포트로 저장
- 리포트 상세 페이지에서 KPI 그대로 재현
- PDF 다운로드
- 외부 공유 링크 (인증 없이 토큰으로 view)

## Approach

기존 `getReportKpis(period)` 결과를 `reports` 테이블에 JSON으로 직렬화하여 저장. 상세 페이지는 저장된 스냅샷을 KpiCard로 재현. PDF는 `@react-pdf/renderer` (handover/backup PDF 패턴). 공유는 reports 테이블에 `share_token` 컬럼 추가 + `/r/[token]` 라우트.

## Out of Scope (이번 PR 외)

- 리포트 자동 생성 (cron) — 현재는 수동 트리거만
- 다국어 PDF
- 리포트 버전 관리 / diff
- 메일로 공유 링크 발송

## 영향 파일 (~18)

### Phase A — DB (3)
- `supabase/migrations/{date}_reports_table.sql` 신규
- `supabase/migrations/{date}b_reports_rls.sql` 신규

### Phase B — features (4)
- `src/features/reports/schemas.ts` 확장 — ReportRow zod
- `src/features/reports/actions.ts` 신규 — createReport / deleteReport
- `src/features/reports/queries.ts` 확장 — listReports / getReportById / getReportByShareToken
- `src/features/reports/__tests__/actions.test.ts` 신규

### Phase C — UI (5)
- `src/app/dashboard/reports/_components/ReportsList.tsx` 갱신 — 실제 DB 데이터
- `src/app/dashboard/reports/_components/NewReportButton.tsx` 신규 — modal trigger
- `src/app/dashboard/reports/_components/NewReportModal.tsx` 신규 — 제목+기간 입력
- `src/app/dashboard/reports/[id]/page.tsx` 신규 — 상세 server component
- `src/app/dashboard/reports/[id]/_components/ReportDetail.tsx` 신규 — KPI 재현

### Phase D — PDF (3)
- `src/lib/pdf/report-pdf.tsx` 신규
- `src/app/api/reports/[id]/pdf/route.ts` 신규 — PDF stream
- (상세 페이지에 다운로드 버튼 추가)

### Phase E — 공유 (3)
- `src/app/r/[token]/page.tsx` 신규 — 게스트 view (인증 우회)
- `src/features/reports/share.ts` 신규 — 토큰 생성/검증
- (상세 페이지에 공유 링크 복사 버튼 추가)

## 단계

### T1: reports 테이블 + RLS
- 파일: 2 마이그
- 스키마: id / title / period / period_range / kpis(jsonb) / status(draft|completed) / share_token / created_by / created_at
- DoD: SQL 실행 후 pg_policies 4건 + 인덱스

### T2: schemas + actions + queries + 테스트
- `ReportRow` zod / `createReport` / `listReports` / `getReportById` / `getReportByShareToken`
- DoD: vitest 통과

### T3: NewReportModal + 생성 흐름
- "+ 새 리포트" 버튼 enable → modal → 제목·기간 입력 → action 호출 → 페이지 갱신
- DoD: 모달 렌더·제출 동작

### T4: ReportsList 실제 데이터 연결 + 상세 페이지
- ReportsList → `listReports()` 결과 렌더, 행 클릭 시 `/dashboard/reports/[id]` 이동
- 상세 페이지: `getReportById()` → KpiCard×N 재현

### T5: PDF
- `report-pdf.tsx` Pretendard 폰트 + KPI 표
- `/api/reports/[id]/pdf` route → buffer 반환
- 상세 페이지에 "PDF 다운로드" 버튼

### T6: 공유 토큰 + 외부 view
- `/r/[token]` 라우트 — 인증 없이 토큰으로 조회 (proxy.ts 화이트리스트)
- 상세 페이지에 "공유 링크 복사" 버튼

### T7: verify + commit + PR

## 리스크

1. **proxy.ts 화이트리스트** — `/r/*`을 미인증 경로로 허용해야 함. 현재 proxy.ts가 /login만 허용. 변경 필요
2. **PDF Pretendard 폰트 로드** — 기존 handover-pdf 패턴 재사용 (font-public 경로)
3. **share_token 추측 방지** — UUID v4 + crypto.randomUUID 사용
4. **modal HTML 미사용** — 기존 ConfirmModal 패턴 또는 단순 inline modal

## 진행 추적

- [ ] T1 — DB 마이그
- [ ] T2 — features
- [ ] T3 — 생성 modal
- [ ] T4 — list + 상세
- [ ] T5 — PDF
- [ ] T6 — 공유
- [ ] T7 — verify + PR
