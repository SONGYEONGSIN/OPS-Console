# OPS Console Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chrome 좌측 brand를 `PIVOT` + `OPS DESK` 조합에서 `OPS Console` 단일 명칭 + `>_` 터미널 프롬프트 로고로 교체.

**Architecture:** ChromeBrand.tsx의 워드마크/로고만 갱신. layout.tsx의 모바일 AppBar 텍스트 동기화. 단위 테스트와 e2e의 PIVOT 어설션을 OPS Console로 갱신. 새 토큰 추가 없음 — 기존 chrome-graphite/snow 재활용.

**Tech Stack:** Next.js App Router, Tailwind v4 (font-mono utility), vitest, playwright.

**Spec:** `docs/superpowers/specs/2026-05-08-ops-console-rebrand-design.md`

**HARD-GATE 등급:** 인라인 설계 (4 파일)

---

## File Structure

### Modify
- `src/app/dashboard/_components/chrome/ChromeBrand.tsx` — 마크 + 워드마크 교체
- `src/app/dashboard/layout.tsx` — AppBar 텍스트 (모바일)
- `src/app/dashboard/_components/chrome/__tests__/Chrome.test.tsx` — 어설션 갱신
- `e2e/dashboard.spec.ts` — 어설션 갱신

---

## Task 1: Chrome.test.tsx 어설션 갱신 (RED 단계)

**Files:**
- Modify: `src/app/dashboard/_components/chrome/__tests__/Chrome.test.tsx`

**Goal:** 기존 `PIVOT` / `OPS DESK` 어설션을 `OPS Console` + `>_` 어설션으로 변경. ChromeBrand 갱신 전이라 RED.

- [ ] **Step 1: 기존 테스트 어설션 갱신**

`src/app/dashboard/_components/chrome/__tests__/Chrome.test.tsx`의 첫 번째 테스트 블록(`좌측 PIVOT brand 노출`)을 다음으로 교체:

```typescript
  it("좌측 OPS Console brand 노출", () => {
    render(<Chrome operator={operator} alerts={[]} />);
    expect(screen.getByText("OPS Console")).toBeInTheDocument();
    expect(screen.getByText(">_")).toBeInTheDocument();
  });
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/chrome/__tests__/Chrome.test.tsx
```

Expected: 1 FAIL — `Unable to find an element with the text: OPS Console`. (두 번째 테스트는 통과)

---

## Task 2: ChromeBrand 구현 갱신 (GREEN)

**Files:**
- Modify: `src/app/dashboard/_components/chrome/ChromeBrand.tsx`

**Goal:** 마크와 워드마크를 OPS Console 디자인으로 교체.

- [ ] **Step 1: ChromeBrand.tsx 전체 교체**

`src/app/dashboard/_components/chrome/ChromeBrand.tsx`:

```tsx
export function ChromeBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="inline-flex h-[22px] w-[26px] items-center justify-center bg-chrome-graphite font-mono text-[13px] font-bold leading-none tracking-[-0.05em] text-chrome-snow"
      >
        &gt;_
      </span>
      <span className="text-base font-extrabold tracking-tight text-chrome-graphite">
        OPS Console
      </span>
    </div>
  );
}
```

- [ ] **Step 2: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/chrome/__tests__/Chrome.test.tsx
```

Expected: 2 passed.

- [ ] **Step 3: 전체 vitest 회귀**

```bash
npm test
```

Expected: 모든 테스트 통과 (244+).

- [ ] **Step 4: typecheck/lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 0 errors.

- [ ] **Step 5: Commit (Chrome.test.tsx + ChromeBrand.tsx)**

```bash
git add src/app/dashboard/_components/chrome/ChromeBrand.tsx src/app/dashboard/_components/chrome/__tests__/Chrome.test.tsx
git commit -m "feat: ChromeBrand — OPS Console + >_ 터미널 프롬프트 로고"
```

---

## Task 3: AppBar(모바일) 텍스트 갱신

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

**Goal:** 모바일 상단 AppBar의 `PIVOT · OPS DESK` 텍스트를 `OPS Console`로 교체. 스타일 전용 변경 (TDD 예외).

- [ ] **Step 1: AppBar 텍스트 교체**

`src/app/dashboard/layout.tsx`의 AppBar 함수 안에서 다음 줄을 교체:

Before:
```tsx
        PIVOT <em className="not-italic mx-0.5 text-vermilion">·</em> OPS DESK
```

After:
```tsx
        OPS Console
```

(앞뒤 `<em>` 점·구분자 제거. 단일 텍스트로 단순화.)

- [ ] **Step 2: typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: dev 서버 시각 확인 (선택)**

dev 서버가 떠있다면 모바일 viewport(<768px)에서 `/dashboard` 진입 → 상단 AppBar에 `OPS Console` 표시 확인.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat: 모바일 AppBar 텍스트 OPS Console 단일화"
```

---

## Task 4: e2e 어설션 갱신

**Files:**
- Modify: `e2e/dashboard.spec.ts`

**Goal:** desktop chrome 테스트의 PIVOT/OPS DESK 어설션을 OPS Console로 변경.

- [ ] **Step 1: e2e 어설션 갱신**

`e2e/dashboard.spec.ts`의 desktop chrome 테스트 블록 안에서 다음 두 줄을 교체:

Before:
```typescript
    await expect(page.getByText("PIVOT", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("OPS DESK").first()).toBeVisible();
```

After:
```typescript
    await expect(page.getByText("OPS Console", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(">_").first()).toBeVisible();
```

(나머지 검색·15:00·세션 어설션은 변경 없음.)

- [ ] **Step 2: e2e 실행 (가능하면)**

dev 서버가 떠있고 e2e가 fixture 인증 처리 가능하면:

```bash
npm run e2e -- dashboard
```

Expected: 갱신된 어설션 PASS. 환경 의존으로 실패 시 BLOCKED 보고하되 코드 변경은 그대로 commit.

- [ ] **Step 3: Commit**

```bash
git add e2e/dashboard.spec.ts
git commit -m "test: e2e chrome 어설션 OPS Console + >_ 로 갱신"
```

---

## Task 5: PIVOT 잔존 검색 + 통합 검증

**Files:** 없음 (검증만)

**Goal:** 코드/테스트에 PIVOT 텍스트 잔존 0건 확인 + 모든 검증 통과.

- [ ] **Step 1: PIVOT 잔존 검색**

```bash
grep -rn "PIVOT\|OPS DESK" src/ e2e/ 2>&1 | grep -v node_modules
```

Expected: 0 matches. (있으면 해당 파일 검토 후 갱신.)

- [ ] **Step 2: lint**

```bash
npm run lint
```

Expected: 0 errors (pre-existing 2 warnings는 무시).

- [ ] **Step 3: typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: 단위 테스트 전체**

```bash
npm test
```

Expected: 모든 테스트 통과 (244+).

- [ ] **Step 5: design-audit hook**

```bash
bash .claude/hooks/design-lint.sh src/app/dashboard/_components/chrome/ChromeBrand.tsx
```

Expected: 0 위반.

- [ ] **Step 6: 메모리 업데이트 (rebrand 사실 기록)**

`/Users/yss/.claude/projects/-Users-yss----build-Folio/memory/project_pivot_to_ops_console.md` 신규 생성:

```markdown
---
name: chrome 명칭 PIVOT → OPS Console rebrand
description: 2026-05-08 chrome 좌측 brand가 PIVOT(모더니즘 사각)에서 OPS Console(>_ 터미널 프롬프트)로 교체됨.
type: project
---

chrome 좌측 brand가 `OPS Console` + `>_` 마크로 확정. 이전 `PIVOT` + `▣` + `OPS DESK` 부제는 모두 폐기.

**Why**: PIVOT은 추상 모더니즘이라 운영 시스템 본질이 약했음. 사용자가 직설적 명칭 + 명령행 메타포로 변경 결정.

**How to apply**:
- 새 chrome 컴포넌트 생성 시 OPS Console 워드마크 + 검은 사각 안 흰 `>_` 모노 패턴 사용
- 테스트/e2e 어설션 작성 시 `OPS Console` + `>_` 검사
- 부제(OPS DESK 류) 추가 금지 — 이름 단독으로 충분
```

`MEMORY.md`에 한 줄 추가:
```markdown
- [chrome rebrand: PIVOT → OPS Console](project_pivot_to_ops_console.md) — 2026-05-08, >_ 터미널 프롬프트 로고
```

- [ ] **Step 7: 최종 검증 commit (필요 시)**

`grep` 결과 잔존이 있으면 별도 commit, 없으면 step 6 메모리 변경만 별도 처리(커밋 X — global memory).

```bash
git status
git log --oneline 2f3f11e..HEAD
```

Expected: Task 2-4 commit 3개 있음 (chrome brand, mobile, e2e).

---

## Self-Review

**1. Spec 커버리지** — spec 모든 섹션 → task 매핑:

| Spec 섹션 | 구현 task |
|---|---|
| 3.1 Identity (OPS Console + 부제 제거 + >_ 로고) | T2 (ChromeBrand) |
| 3.2 ChromeBrand 변경 | T2 |
| 3.3 모바일 AppBar 변경 | T3 |
| 3.4 테스트 갱신 (Chrome.test) | T1, T2 |
| 3.4 테스트 갱신 (e2e) | T4 |
| 4. 영향 파일 (4 파일) | T1-T4 |
| 7. 테스트 전략 | T1, T2, T4 |
| 9. DoD | T5 |

**누락 없음.**

**2. Placeholder scan**: 모든 step에 실제 코드/명령. "TBD/적절히/추후" 없음.

**3. Type/이름 일관성**:
- `OPS Console` 정확히 동일 표기 (대소문자) 모든 task
- `>_` 정확히 동일 (Chrome.test, ChromeBrand, e2e)
- font-mono / chrome-graphite / chrome-snow 토큰 정확

**완료.**
