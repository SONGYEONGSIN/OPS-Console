---
plan_id: 20260713-001500-hover-standard-line-soft
status: completed
created: 2026-07-13T00:15:00Z
hard_gate: full
source: planner-analysis (호버 통일 대상 분류, 61건 전수)
---

# Plan: 운영가이드 기준 호버/선택 배경 전역 통일

## Goal

운영가이드 좌측 레일 nav를 표준으로 확정하고, 목록/메뉴 항목형 UI 전체를 그 기준으로 통일:
- 비활성 호버: `hover:bg-line-soft` (12% ink 오버레이 — 기존 `hover:bg-washi-raised`/`hover:bg-sidebar-hover` 대체)
- 선택: `bg-vermilion/10` (+vermilion 보더/텍스트) — #846에서 대부분 완료, 잔여 1건 정리

## Approach

planner 전수 분류(61건) 기반 선별 치환. 버튼/토글/페이지네이션(B군 9건)과 KPI 히어로 타일(3건)은 제외 — 버튼 호버는 별도 표준. 일괄 sed 금지, A군 파일만 치환 후 잔여 카운트로 검증.

## Out of Scope

- B군 버튼류 호버 (별도 표준 `hover:bg-ink hover:text-cream` 정비는 별도 작업)
- `hover:bg-washi` 등 다른 호버 토큰
- 메일 HTML/PDF 내장 색

## Tasks

### T1: A군 호버 치환 (45파일 46건)
- **상태**: done
- list-variants Table 26 + 자동완성 3 + live 6 + 크롬 드롭다운/목록 4 + 기타 테이블 7
- `hover:bg-washi-raised` → `hover:bg-line-soft`

### T2: C군 채택분 치환 (2파일 3건)
- **상태**: done
- dev-test/View.tsx 아코디언 행, AssistantClient.tsx 프롬프트 카드(bg만), HandoverWizard.tsx:559 아코디언 헤더
- KpiHeroStrip 3건은 제외(대형 요약 카드)

### T3: 메인 사이드바 + orphan 토큰 (2파일)
- **상태**: done
- Sidebar.tsx 2곳 `hover:bg-sidebar-hover` → `hover:bg-line-soft`
- globals.css `--sidebar-hover`/`--color-sidebar-hover` 정의 제거 (완전 orphan)

### T4: 선택 상태 잔여 표준화 (Content.tsx)
- **상태**: done
- ServiceCard 선택 `bg-washi-raised`/`max-md:bg-washi-raised` → `bg-vermilion/10` (vermilion 보더 pseudo 유지)

### T5: 검증
- **상태**: done
- 잔여 `hover:bg-washi-raised` = 정확히 12건(B군 9 + KpiHero 3), `hover:bg-sidebar-hover` = 0
- lint + typecheck + vitest 전체

## 검증 기준

스타일 전용(TDD 예외)이나 검증 필수: 잔여 카운트 일치 + lint/typecheck/unit 전부 통과.
