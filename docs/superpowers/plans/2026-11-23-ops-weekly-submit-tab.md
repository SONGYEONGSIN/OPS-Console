# 주간업무보고 제출 탭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** 영역 확인 필수를 없애고, 영역 탭 끝 `제출` 탭에서 요약을 보고 제출한다.
**Architecture:** `_params` 에 `ReportTab = AreaTab | "submit"`, 주소 `tab=submit` 은 report 역할. `ReportLayout` 이 `submit` 슬롯을 받으면 탭과 패널을 하나 더 그린다. 건수는 새 `_area-counts.ts` 하나를 탭 제목과 요약이 같이 쓴다.
**Tech Stack:** Next.js 16 App Router, React, Vitest + Testing Library
**Spec:** `docs/superpowers/specs/2026-11-23-ops-weekly-submit-tab-design.md`

## Global Constraints
- DB `checked_tabs` 컬럼·스키마는 그대로(마이그레이션 없음)
- 버튼 문구 `제출완료`, 탭 이름 `제출`, 빈 특이사항 `없음`
- 제출 자리는 한 곳 — 머리띠에는 없다

## Review Focus
- `?tab=submit` 으로 전체 보고·남의 보고서를 열면 → 원서접수로 보인다 (Task 2 테스트)
- 제출한 뒤 `제출` 탭 → 버튼 대신 `제출함 시각` (Task 2 테스트)
- 특이사항 저장 직후 탭 이동 → 요약이 새 값 (`saveAreaNote` 가 revalidate — 기존 동작, 저장 대기 중 제출은 `useSubmit` 이 막음)

### Task 1: 서버 — 제출 조건 제거
**Files:** `workflow-actions.ts`, `permissions.ts`, `actions.ts`(+`markTabChecked` 와 그 schema), 테스트 셋
- [ ] RED: `workflow-actions.test` — `checked_tabs: ["application"]` 이어도 `submitReport` 가 `{ ok: true }`
- [ ] GREEN: gate 삭제, `uncheckedAreas`·`markTabChecked` 와 해당 테스트 삭제

### Task 2: 화면 — 제출 탭
**Files:** `_params.ts`, `use-ops-area.ts`, `AreaTabs.tsx`, `ReportLayout.tsx`, `ReportView.tsx`, 새 `SubmitTab.tsx`, 새 `_area-counts.ts`, `ApplicationTab/PimsTab/LeaveTab.tsx`, `SubmitBar.tsx`, `page.tsx`, `WeekHeader.tsx`, `AreaNotes.tsx`, 삭제 `AreaCheckButton.tsx`
**Interfaces:** `areaCounts(snapshot, detail): Record<"application"|"pims"|"leave", {auto:number; direct:number}>` · `visibleArea(area: ReportTab, withSubmit: boolean): ReportTab` · `SubmitTab({snapshot, detail, reportId, canSubmit, status, submittedAt})`
- [ ] RED: `SubmitTab.test` — 영역 넷 머리(`원서접수` `자동 n건 · 직접 n건`), 특이사항 본문/`없음`, 프로젝트 줄, `제출완료` → `submitReport({reportId})`, 머리 클릭 → `tab=` 그 영역, 제출함이면 `제출함` 문구
- [ ] RED: `page-subtabs` — 본인 보고서에 `제출` 탭, 머리띠에 `제출완료` 없음, `tab=submit` 에 하나, `이 영역 확인`·`남은 확인`·`확인 n/5` 없음, 남의 보고서·전체 보고에 `제출` 탭 없음
- [ ] GREEN 구현 → `npm test -- ops-weekly` · `npm run typecheck` · `npm run lint`
- [ ] CLAUDE.md 갱신, PR
