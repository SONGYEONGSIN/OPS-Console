---
plan_id: 20260516-001500-backup-mode-toggle
status: completed
created: 2026-05-16T00:15:00Z
completed: 2026-05-16T08:30:00Z
hard_gate: inline
source: brainstorm:.claude/memory/brainstorms/20260516-001000-backup-mode-toggle.md
branch: feat/backup-mode-toggle
pr: 114
---

# Plan: 백업 요청 mode toggle (PR-5)

## Goal

EditForm 상단에 "백업 방식" 세그먼트 컨트롤 (`single` | `perService`) 추가 → 폼을 모드에 따라 분기. `single`은 상단 백업자 1명, `perService`는 카드마다 백업자. 데이터 모델 변경 없음.

## Approach

frontend state 추가 + 분기 렌더링. ServiceCard에 `showSubstituteSelect` prop으로 카드 select 노출 토글. EditForm `onSave` 직전 `perService` 모드일 때 `parent.substituteEmail/Name`을 *첫 명시된 카드의 백업자*로 자동 채움 (DB NOT NULL 충족).

## Out of Scope

- 편집 모드 진입 시 mode auto-detect (편집 자체가 후속 PR)
- 모든 카드 일괄 변경 bulk 액션
- mode를 DB에 영구 저장
- 메모 구조 변경

## 영향 파일

| 파일 | 변경 유형 |
|------|----------|
| `src/app/dashboard/_components/inspector/list-variants/backup/ServiceCard.tsx` | `showSubstituteSelect` prop 추가 |
| `src/app/dashboard/_components/inspector/list-variants/backup/__tests__/ServiceCard.test.tsx` | hide 케이스 추가 |
| `src/app/dashboard/_components/inspector/list-variants/backup/EditForm.tsx` | mode state + 세그먼트 컨트롤 + 분기 + onSave 보정 |
| `src/app/dashboard/_components/inspector/list-variants/backup/__tests__/EditForm.test.tsx` | mode 토글 케이스 + 분기 검증 |

## 단계

### T1: ServiceCard — `showSubstituteSelect` prop

- **상태**: pending
- **파일**: `src/app/dashboard/_components/inspector/list-variants/backup/ServiceCard.tsx` + 테스트
- **변경**:
  - `Props`에 `showSubstituteSelect?: boolean` 추가 (default `true`)
  - 헤더 영역의 `<select aria-label={...백업자}>`를 `showSubstituteSelect`가 `true`일 때만 렌더링
- **DoD**: ServiceCard 신규 테스트 — `showSubstituteSelect={false}` 전달 시 백업자 select 부재
- **의존**: 없음

### T2: EditForm — mode state + 세그먼트 컨트롤 + 분기 + onSave 보정

- **상태**: pending
- **파일**: `src/app/dashboard/_components/inspector/list-variants/backup/EditForm.tsx` + 테스트
- **변경**:
  - state `const [mode, setMode] = useState<"single" | "perService">("single");`
  - 폼 최상단에 `role="radiogroup" aria-label="백업 방식"` 컨트롤 (버튼 2개, `aria-pressed` 토글)
  - `mode === "single"`일 때만 상단 "백업자" select 노출 (기존 라벨 "기본 백업자"는 "백업자"로 환원 — 이중 의미 불필요)
  - `<ServiceCard showSubstituteSelect={mode === "perService"} ... />` 전달
  - `onSubmit`에서 `mode === "perService"`일 때, `row` 복제 후 `substituteEmail`이 비었으면 첫 명시 카드의 substitute_email/name으로 채워서 `onSave(adjustedRow)`:
    ```tsx
    function handleSubmit(e: FormEvent) {
      e.preventDefault();
      if (mode === "perService") {
        const firstAssigned = selectedDetail.find((s) => s.substitute_email);
        if (firstAssigned && !row.substituteEmail) {
          onSave({
            ...row,
            substituteEmail: firstAssigned.substitute_email ?? "",
            substituteName: firstAssigned.substitute_name ?? "",
          });
          return;
        }
      }
      onSave(row);
    }
    ```
  - 기존 보조 안내문구 ("서비스 카드에서 미지정 시 적용") 제거 — mode toggle로 의도 명확
- **DoD**: EditForm 신규 테스트
  - 기본 mode = "single", 상단 백업자 select 노출
  - "서비스별" 클릭 시 상단 백업자 select 부재 + 카드에 select 노출 (ServiceCard 통해)
  - "서비스별" 모드 + 카드에 백업자 명시 + 저장 → `onSave`에 `substituteEmail`이 첫 카드 값으로 채워져 호출
  - "1명 일괄" 모드 클릭 후 다시 노출되는 상단 select 라벨이 "백업자"
- **의존**: T1

### T3: 회귀 + verify + 로컬 확인

- **상태**: pending
- **파일**: 신규 변경 없음
- **변경**: `npm run lint && npm run typecheck && npm test`
- **DoD**:
  - 모든 unit PASS (mode toggle 추가 테스트 포함)
  - 0 error / 기존 warning만
  - 로컬 dev `/dashboard/backup` 신규 등록 — "1명 일괄"로 등록·"서비스별"로 등록 두 케이스 모두 정상 저장
- **의존**: T1, T2

## 리스크

| 리스크 | 완화책 |
|--------|--------|
| mode 전환 시 카드 substitute_email 손실 | UI에서만 숨김. 카드 데이터 유지 (`row.backupServicesDetail`는 그대로) |
| perService + 모든 카드 미명시 → parent empty | zod schema가 `substitute_email: email()` 요구하므로 자동 차단. 추가 validation 없음 (YAGNI) |
| 사용자가 mode 전환 후 의도 잃음 | 세그먼트 컨트롤 시각적으로 강한 상태 표시 (`aria-pressed`) + 즉시 폼 분기 |
| 기존 PR-4 e2e backup spec 라벨 변경 영향 | 이번 PR로 e2e는 갱신하지 않음. e2e 라벨 갱신은 별도 백로그 |

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|-----------|------|
| 2026-05-16T00:15:00Z | — | plan 생성 | brainstorm 20260516-001000 입력. branch `feat/backup-mode-toggle` |
| 2026-05-16T08:30:00Z | T1~T3 | 일괄 완료 | PR #114 squash merge (commit bb411fb). 사용자 로컬 확인 후 라벨/너비 보정 commit 1개 추가 후 머지 |
