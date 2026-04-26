# Login Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Folio `/login` 라우트가 `design-ref/folio-login.html` mockup과 좌표 단위로 정확히 매칭되도록 layout/sizing/spacing 격차 좁히기.

**Architecture:** 카테고리별 incremental fix. (1) Task 1에서 진단 deep-dive로 root cause 식별 → (2) Category A(input/button 크기) → (3) Category C(horizontal 시프트) → (4) Category B(vertical 시프트) 순서 fix. 각 fix 후 `diagnose-layout.mjs` 재실행해 좌표 매칭 진전 확인. 모든 카테고리 fix 후 Task 5에서 종합 검증.

**Tech Stack:** Next.js 16 (App Router) + React 19 + Tailwind CSS v4. 측정 도구는 Playwright(visual diagnostic + e2e), pixelmatch(design-sync), pngjs.

**Repository note:** Folio는 git 저장소가 아님. "commit" 단계는 *"검증 통과 확인 + 산출물 보고"* 로 대체.

**Spec 참조:** `design-ref/2026-04-26-login-refinement-design.md`

---

## File Structure

이 plan에서 수정/생성/참조되는 파일:

- **Modify**: `src/app/login/page.tsx` — `BrandPanel` / `AuthPanel` / `Field` / `SSOButton` / `TitleBar` / `StatusBar` 함수 컴포넌트들 (이 파일 안에 inline)
- **Conditional modify**: `src/app/globals.css` — Task 2 진단에서 input base 스타일이 필요하다고 결론 났을 경우만
- **Reference (no edit)**:
  - `design-ref/folio-login.html` (mockup CSS spec — Truth source)
  - `scripts/diagnose-layout.mjs` (좌표 측정 도구)
  - `scripts/design-sync.mjs` (sync% 측정)
- **Append-only**:
  - `design-ref/2026-04-26-login-refinement-design.md` (Task 1 진단 결과를 부록으로 추가)
  - `/Users/yss/.claude/projects/-Users-yss----build-Folio/memory/MEMORY.md` (Task 5에서 메모리 인덱스 추가)
- **Untouched**: `src/features/auth/*`, `src/app/layout.tsx`, `src/middleware.ts`, `src/lib/design-tokens.ts`

---

## Task 1: Diagnostic Deep-Dive

격차의 root cause를 정확히 식별. 코드 변경 없음. fix 방향 명확화.

**Files:**
- Reference: `design-ref/folio-login.html`, `src/app/login/page.tsx`, `src/app/globals.css`
- Append: `design-ref/2026-04-26-login-refinement-design.md` (부록 A 추가)

- [ ] **Step 1: dev 서버 가동 확인**

```bash
lsof -i :3010 -P -n
```

Expected: 이미 떠있으면 reuse. 안 떠있으면 새 터미널에서:
```bash
npx next dev -p 3010
```

ready until 메시지 (`Local: http://localhost:3010`) 확인.

- [ ] **Step 2: Baseline 좌표 측정**

```bash
LOCAL_BASE=http://localhost:3010 node scripts/diagnose-layout.mjs > /tmp/diag-baseline.txt
cat /tmp/diag-baseline.txt
```

Expected: 14 element의 mockup vs ours 좌표 + Δx/Δy 출력. design.md §2 격차 inventory와 일치 — input height 39 vs 20, 입실 버튼 48 vs 39, 콘텐츠 vertical shift 50–101px, horizontal -40px 등.

- [ ] **Step 3: Category A 진단 — input height 원인**

브라우저로 http://localhost:3010/login 접속, dev tools(Cmd+Opt+I) 열기.

`<input name="email">` element 선택 후 **Computed** 패널에서 다음 값 기록:
- `height`
- `padding-block-start`, `padding-block-end`
- `box-sizing`
- `font-size`, `line-height`

별도 브라우저 탭에서 `file:///Users/yss/개발/build/Folio/design-ref/folio-login.html` 열기. 같은 input 선택, 같은 measurements 기록.

진단 노트 (텍스트 작성):
```
Category A 진단:
- mockup input: padding-block-start=___, height=___, font-size=___, line-height=___
- ours input:   padding-block-start=___, height=___, font-size=___, line-height=___
- 차이 원인: ____________
- Fix 방향: ____________
```

- [ ] **Step 4: Category B 진단 — vertical 시프트 원인**

dev tools(우리 빌드)에서:
- `<aside>` (brand panel) computed `height` 기록
- `<section>` (auth panel) computed `height` 기록
- 우리 grid main인 `<main>` computed `grid-template-rows` 실제 값 기록
- main의 computed `height` 기록 (mockup `.main`도 동일하게)

진단 노트:
```
Category B 진단:
- main height: mockup ___, ours ___
- brand panel height: mockup ___, ours ___
- auth panel height: mockup ___, ours ___
- main grid-template-rows: mockup ___, ours ___
- 차이 원인: ____________
- Fix 방향: ____________
```

- [ ] **Step 5: Category C 진단 — horizontal 시프트 원인**

dev tools에서:
- `<aside>` (brand) computed `padding-inline-start` (또는 `padding-left`) 값
- brand 첫 자식 element offset (예: `<h1>` 입실 헤딩의 `getBoundingClientRect().x`)
- brand panel과 그 자식 사이에 또 다른 wrapper(div)가 있는지

진단 노트:
```
Category C 진단:
- brand padding-inline-start: mockup ___, ours ___
- brand 첫 자식 offset.x: mockup ___, ours ___
- 자식과 panel 사이 wrapper 존재? ____________
- 차이 원인: ____________
- Fix 방향: ____________
```

- [ ] **Step 6: 진단 결과를 design.md 부록 A로 추가**

`design-ref/2026-04-26-login-refinement-design.md` 파일 끝에 다음 내용 append:

```markdown

## 부록 A: Diagnostic 결과 (Task 1)

### Category A (input/button 크기)
- **Root cause**: [Step 3 진단 결과 — 한 문장]
- **Fix 방향**: [구체 변경 항목 — `src/app/login/page.tsx`의 어느 element class 어떻게]

### Category B (vertical 시프트)
- **Root cause**: [Step 4 진단 결과]
- **Fix 방향**: [구체 변경 항목]

### Category C (horizontal 시프트)
- **Root cause**: [Step 5 진단 결과]
- **Fix 방향**: [구체 변경 항목]
```

각 항목은 1-3문장 + 변경할 line/class를 구체적으로.

- [ ] **Step 7: 체크포인트 — 진단 완료 보고**

다음 형식으로 보고:
```
Task 1 완료 — Diagnostic Deep-Dive

진단 결과 (부록 A로 design.md에 저장됨):
- Category A: [root cause 한 줄] → [fix 방향 한 줄]
- Category B: [root cause 한 줄] → [fix 방향 한 줄]
- Category C: [root cause 한 줄] → [fix 방향 한 줄]

다음 Task 2(Category A fix)에서 위 fix 방향대로 적용 + 측정.
```

이 시점에서 `superpowers:requesting-code-review` 호출 가능 (선택). 진단이 합리적인지 review 받고 다음 Task 진행.

---

## Task 2: Category A — Input/Button 크기

Task 1 부록 A의 Category A "Fix 방향"대로 input height 39px, 입실 버튼 48px 매칭.

**Files:**
- Modify: `src/app/login/page.tsx` (`Field` 컴포넌트의 `<input>`, `SubmitButton` 컴포넌트의 `<button>`)
- Conditional modify: `src/app/globals.css` (Task 1 부록 A에서 결론 났으면)

- [ ] **Step 1: 부록 A Category A "Fix 방향" 적용**

`design-ref/2026-04-26-login-refinement-design.md` 부록 A의 Category A 항목 읽고, *그 항목에 적힌 정확한 변경*을 코드에 적용.

가능한 fix 패턴 예시 (Task 1 결론에 따라 하나만 적용):

**(예시 1) input padding 미적용 — globals.css에 base 추가:**
```css
/* src/app/globals.css 끝에 추가 */
input[type="text"],
input[type="password"],
input[type="email"] {
  /* mockup .field input 스타일 인라인 보장 (Tailwind preflight 회피) */
  padding-block: var(--space-3);
}
```

**(예시 2) Field 컴포넌트 input에 min-h:**
```tsx
// src/app/login/page.tsx Field 컴포넌트 input className 수정
<input
  id={id}
  name={id}
  {...inputProps}
  className="w-full border-none bg-transparent py-3 text-md tracking-[-0.005em] text-ink outline-none placeholder:text-faint min-h-[39px]"
/>
```

**(예시 3) box-sizing 또는 height 명시:**
[Task 1 진단 결과 기반]

(부록 A의 정확한 fix 방향대로)

- [ ] **Step 2: 측정 — input/button height 매칭 확인**

```bash
LOCAL_BASE=http://localhost:3010 node scripts/diagnose-layout.mjs | grep -E "이메일 input|비밀번호 input|입실 · 로그인"
```

Expected:
- 이메일 input: size 420×39 → ours 420×39 ✓ (was 420×20)
- 비밀번호 input: 420×39 → 420×39 ✓
- 입실 · 로그인 버튼: 420×48 → 420×48 ✓ (was 420×39)

- [ ] **Step 3: tsc 회귀**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: lint 회귀**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 5: e2e 회귀 (인증 인터랙션 보존 확인)**

```bash
npm run test:e2e
```

Expected: 40 passed / 0 failed (변동 없음). 입력 필드/버튼 크기 변경이 인터랙션 회귀 없는지 확인.

- [ ] **Step 6: 체크포인트 — Category A 완료 보고**

```
Task 2 완료 — Category A (input/button 크기)

매칭 결과:
- 이메일 input height: 20 → 39 ✓
- 비밀번호 input height: 20 → 39 ✓
- 입실 버튼 height: 39 → 48 ✓

회귀: tsc/lint/e2e 모두 통과 (40 passed)
변경 파일: src/app/login/page.tsx [+ src/app/globals.css 가능]
```

---

## Task 3: Category C — Horizontal 시프트

Task 1 부록 A의 Category C "Fix 방향"대로 brand panel padding이 자식에 일관 적용.

**Files:**
- Modify: `src/app/login/page.tsx` (`BrandPanel` 컴포넌트 또는 brand-center wrapper)

- [ ] **Step 1: 부록 A Category C "Fix 방향" 적용**

가능한 fix 패턴 예시 (Task 1 결론에 따라):

**(예시 1) brand-center에 잘못된 negative margin 제거:**
```tsx
// before
<div className="relative z-10 max-w-[440px] max-lg:max-w-none max-md:mt-4 -ml-X">
// after
<div className="relative z-10 max-w-[440px] max-lg:max-w-none max-md:mt-4">
```

**(예시 2) brand panel 직접 자식에 padding 명시:**
[부록 A 정확한 fix]

**(예시 3) max-w-[440px]가 panel left edge에 닿는 경우 wrapping 조정:**
[부록 A 정확한 fix]

- [ ] **Step 2: 측정 — Δx 매칭 확인**

```bash
LOCAL_BASE=http://localhost:3010 node scripts/diagnose-layout.mjs | grep -E "헤딩|OBSERVE|관 · 응 · 대"
```

Expected:
- 입실 헤딩 Δx: -40 → < 5px ✓
- OBSERVE Δx: -40 → < 5px ✓
- 관 · 응 · 대 Δx: -40 → < 5px ✓

- [ ] **Step 3: tsc 회귀**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: lint 회귀**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 5: e2e 회귀**

```bash
npm run test:e2e
```

Expected: 40 passed / 0 failed.

- [ ] **Step 6: 체크포인트 — Category C 완료 보고**

```
Task 3 완료 — Category C (horizontal 시프트)

매칭 결과:
- 입실 헤딩 Δx: -40 → ~0 ✓
- OBSERVE Δx: -40 → ~0 ✓
- 관 · 응 · 대 Δx: -40 → ~0 ✓

회귀: tsc/lint/e2e 모두 통과
```

---

## Task 4: Category B — Vertical 시프트

Task 1 부록 A의 Category B "Fix 방향"대로 main 행 940px이 panel 자식에 정확 전달, brand `justify-between` / auth `justify-center` 정상 작동.

**Files:**
- Modify: `src/app/login/page.tsx` (outer grid 또는 panel wrapper)

- [ ] **Step 1: 부록 A Category B "Fix 방향" 적용**

가능한 fix 패턴 예시 (Task 1 결론에 따라):

**(예시 1) main grid에 명시적 row 강제:**
```tsx
// before
<main className="grid h-full min-h-0 grid-cols-1 grid-rows-1 lg:grid-cols-2">
// after
<main className="grid h-full min-h-0 grid-cols-1 [grid-template-rows:1fr] lg:grid-cols-2">
```

**(예시 2) brand/auth panel에 h-full 명시:**
```tsx
<aside className="... h-full">
```

**(예시 3) mockup의 inner div 구조 미러링 (예: brand-center를 div로 wrap):**
[부록 A 정확한 fix]

- [ ] **Step 2: 측정 — Δy 매칭 확인 (모든 element)**

```bash
LOCAL_BASE=http://localhost:3010 node scripts/diagnose-layout.mjs
```

Expected: 14 element 전부 Δy < 5px. 특히:
- 관 · 응 · 대 Δy: +58 → < 5 ✓
- 계정 인증 헤딩 Δy: +101 → < 5 ✓
- Microsoft SSO 버튼 Δy: +53 → < 5 ✓
- 입실 버튼 Δy: -69 → < 5 ✓
- MS-2026-042 푸터 Δy: -121 → < 5 ✓

- [ ] **Step 3: tsc 회귀**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: lint 회귀**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 5: e2e 회귀**

```bash
npm run test:e2e
```

Expected: 40 passed / 0 failed.

- [ ] **Step 6: 체크포인트 — Category B 완료 보고**

```
Task 4 완료 — Category B (vertical 시프트)

매칭 결과 (전체 element):
- 모든 14 element Δy < 5px ✓

회귀: tsc/lint/e2e 모두 통과
```

---

## Task 5: Final Validation + 회귀

design.md §5 Testing 임계 모두 통과 확인.

**Files:** (검증만, 변경 없음)

- [ ] **Step 1: 정량 (좌표) — 전체 element 매칭**

```bash
LOCAL_BASE=http://localhost:3010 node scripts/diagnose-layout.mjs
```

Expected: 14 element 전부 Δx < 5px **AND** Δy < 5px.

- [ ] **Step 2: 정량 (픽셀) — sync 97%+**

```bash
LOCAL_BASE=http://localhost:3010 npm run design-sync
```

Expected: login desktop sync **97%+** (baseline 94.4%에서 ≥2.6%p 개선).

- [ ] **Step 3: 정량 (코드) — tsc**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: 정량 (코드) — lint**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 5: 정량 (코드) — fresh build**

```bash
rm -rf .next && npx next build
```

Expected: exit 0, 4 routes prerendered (`/`, `/_not-found`, `/dashboard`, `/login`), middleware Proxy 인식.

- [ ] **Step 6: 정량 (회귀) — Vitest**

```bash
npm test
```

Expected: 1 file / 6 tests passed.

- [ ] **Step 7: 정량 (회귀) — Playwright e2e**

```bash
npm run test:e2e
```

Expected: 40 passed / 16 skipped / 0 failed.

- [ ] **Step 8: 정성 — 사용자 시각 검증 요청**

다음 형식으로 사용자에게 보고:
```
Login refinement plan 모든 검증 통과:
- 좌표 매칭: 14/14 element Δ < 5px
- sync %: ___ (97%+ 임계 통과)
- 코드 검증: tsc/lint/build 모두 exit 0
- 회귀: Vitest 6/6 + Playwright 40 passed

mockup HTML과 Folio /login을 동시 띄워 시각 검증 부탁드립니다:
- mockup: open /Users/yss/개발/build/Folio/design-ref/folio-login.html
- Folio: http://localhost:3010/login (또는 사용자가 띄운 포트)

"동일하다"고 인정하시면 plan 종료.
```

사용자 시각 인정 응답 대기. 만약 잔존 격차 보고되면 추가 task로 plan revise.

- [ ] **Step 9: 메모리 업데이트**

발견된 fix 패턴을 메모리에 저장 — dashboard plan에서 재사용.

`/Users/yss/.claude/projects/-Users-yss----build-Folio/memory/feedback_layout_debugging.md` 작성:
```markdown
---
name: Layout debugging — mockup ↔ React port 격차 좁히기
description: Tailwind v4 + Next.js 환경에서 mockup HTML과 React 포팅 결과의 좌표 격차를 좁히는 진단 패턴
type: feedback
---

[Task 1-4에서 발견한 root cause + fix 패턴 정리]

**Why:** 2026-04-26 Folio login refinement에서 sync%만으로는 detail 격차 못 잡음을 확인. 좌표 단위 진단(`scripts/diagnose-layout.mjs`)이 결정적.

**How to apply:** dashboard reconstruction 등 차후 mockup-React 정합 작업 시:
1. `diagnose-layout.mjs`로 좌표 baseline
2. dev tools computed style로 root cause 진단
3. 카테고리별(크기/horizontal/vertical) incremental fix
4. 각 fix 후 재측정
```

`/Users/yss/.claude/projects/-Users-yss----build-Folio/memory/MEMORY.md` 끝에 인덱스 라인 추가:
```markdown
- [Layout debugging 패턴](feedback_layout_debugging.md) — mockup ↔ React 포팅 격차의 좌표 진단 + 카테고리별 fix
```

- [ ] **Step 10: 최종 체크포인트 — Plan 종료 보고**

```
Login refinement plan 종료.

산출물:
- design.md: design-ref/2026-04-26-login-refinement-design.md
- plan.md: design-ref/2026-04-26-login-refinement-plan.md
- 코드 변경: src/app/login/page.tsx [+ src/app/globals.css 가능성]
- 메모리: feedback_layout_debugging.md

검증 결과:
- 좌표 14/14 element Δ < 5px
- sync %: ___
- 회귀 0
- 사용자 시각 인정 ✓

다음 단계:
- Dashboard reconstruction brainstorm + plan (별도 세션)
- design-ref/folio-dashboard.html 격차가 더 큼 ("사실상 다른 앱" 수준)
- Login에서 잡힌 fix 패턴은 feedback_layout_debugging.md에서 재사용
```

이 시점에서 `superpowers:requesting-code-review` 호출해 최종 review 받는 것 권장 (선택).
