# Brainstorm — 백업 요청 mode toggle (PR-5)

생성: 2026-05-16
관련 PR: #113 (PR-4 서비스 단위 재구조화) 후속

## 배경

PR #113로 폼은 "상단 기본 백업자(fallback) + 카드마다 백업자 select(override)" 구조. 사용자 피드백:
- 두 군데에서 백업자 결정 → 혼란
- 의사결정 자연 순서가 어긋남
- "백업자 1명 고정 vs 서비스마다 다름"을 먼저 결정해야 직관적

## 사용자 의사결정

| # | 결정점 | 답 |
|---|--------|----|
| 1 | mode UI 형상 | **세그먼트 컨트롤** (상단 라디오 키 두 개). single ↔ perService 즉시 전환 |
| 2 | 메모 구조 | **PR-4 그대로 유지** — 공통 메모 + 서비스별 메모 둘 다 (변경 없음) |

## 새 mode 동작

| mode | UI | 데이터 흐름 |
|------|----|-----------|
| `single` (default) | 상단 백업자 select 노출 / 카드의 백업자 select 숨김 | 카드 substitute_email/name = null → actions.ts의 기존 fallback이 parent.substitute_email/name 채움 |
| `perService` | 상단 백업자 select 숨김 / 카드의 백업자 select 노출 | 각 카드 substitute_email/name 명시. onSave 직전 parent.substitute_email/name을 첫 카드 백업자로 자동 채움 (DB NOT NULL 충족용) |

mode는 **frontend state만** — DB 컬럼 변경 없음. 저장된 row의 substitute_email 패턴(모두 null vs 모두 명시)으로 모드를 사후 추론 가능.

## 폼 형상

```
백업 방식  [● 1명 일괄]  [○ 서비스별]   ← 세그먼트 컨트롤

[single]                      [perService]
요청자 / 제목 / 휴가 시작·종료일   (동일)

백업자 [김슬기 ▾]              (백업자 select 숨김)

담당 서비스 (N/20)
[검색]
┌ 경찰대학 — 신입학  [×]       ┌ 경찰대학 — 신입학 [김슬기▾] [×]
│  연락처 [+...]               │  연락처 [+...]
│  메모 [...]                  │  메모 [...]
└                              └

공통 메모 (textarea)           공통 메모 (textarea)
```

## 영향 파일

| 파일 | 변경 |
|------|------|
| `src/app/dashboard/_components/inspector/list-variants/backup/EditForm.tsx` | mode state + 세그먼트 컨트롤 + 분기 렌더링 + onSave 직전 parent.substituteEmail 자동 채움 |
| `src/app/dashboard/_components/inspector/list-variants/backup/ServiceCard.tsx` | `showSubstituteSelect: boolean` prop (default true). false 시 select 미렌더링 |
| `src/app/dashboard/_components/inspector/list-variants/backup/__tests__/EditForm.test.tsx` | mode 토글 케이스 추가, 분기 검증 |
| `src/app/dashboard/_components/inspector/list-variants/backup/__tests__/ServiceCard.test.tsx` | showSubstituteSelect=false 시 select 부재 검증 |

**HARD-GATE: 인라인 설계 등급** — 4 파일 / 데이터·API 영향 없음 / 단일 PR.

## 리스크

| 리스크 | 완화책 |
|--------|--------|
| mode 전환 시 카드 substitute_email 손실 | 양 방향 모두 유지 (UI에서만 숨김). 모드 복원 시 데이터 보존 |
| perService 모드 + 서비스 0개 → parent.substitute_email empty | 기존 zod schema (`substitute_email: email().min(1)`)가 차단. 추가 validation 없음 |
| perService 모드 + 일부 카드만 백업자 명시 | onSave 직전 첫 *명시된* 카드를 parent로. 명시된 카드 없으면 zod fail로 차단 |
| 사용자가 mode 모르고 single에서 카드 select 찾음 | 라벨 명확화: "백업 방식" + 세그먼트 텍스트 |

## Out of Scope

- 편집 모드 진입 시 mode auto-detect (편집 자체가 후속 PR)
- "모든 카드 일괄 변경" bulk 액션
- mode를 DB에 영구 저장
- 메모 구조 변경 (공통/서비스별 결정 유지)

## 다음 단계

1. 사용자 spec review
2. 승인 시 writing-plans 스킬로 step 분해
3. 단일 branch `feat/backup-mode-toggle` PR
