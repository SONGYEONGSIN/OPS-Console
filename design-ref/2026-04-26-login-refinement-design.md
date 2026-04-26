# Login Refinement — 설계 문서

- **대상**: `src/app/login/page.tsx` (Folio /login 라우트)
- **레퍼런스**: `design-ref/folio-login.html` (mockup, 설계 그대로 따라야 할 spec)
- **작성일**: 2026-04-26
- **작업자**: 송영석 (ysong2526@gmail.com)
- **범위**: 좌표 단위 mockup 정확 매칭. 인증 로직 / 컴포넌트 추출 / 추가 라우트는 out of scope

---

## 1. 배경

`src/app/login/page.tsx`는 mockup `design-ref/folio-login.html`을 React로 1차 포팅한 결과물이다. `npm run design-sync` 픽셀 비교 시 desktop sync 94.4%로 통계상 가까워 보였으나, 사용자 시각 검증에서 **명확한 격차** 인지됨. `scripts/diagnose-layout.mjs`로 좌표 단위 측정 시 element 절반 이상이 mockup 대비 의미 있는 시프트를 보임 (자세히는 §2).

원인: 1차 포팅 과정에서 누적된 미세 mismatch (padding 비대칭 부정확, layout grid의 1fr row 전달, input 크기 mockup 미일치 등). 인증 Server Action 등 React 로직은 정상 동작 — 격차는 **시각/구조 영역에 한정**.

## 2. 격차 inventory

`scripts/diagnose-layout.mjs` 측정 결과 (viewport 1366×900):

### 2.1 Element 크기 차이 (카테고리 A)

| Element | Mockup | Ours | 격차 |
|---|---|---|---|
| 이메일 input height | 39px | 20px | **−19px (절반)** |
| 비밀번호 input height | 39px | 20px | −19px |
| "입실 · 로그인" 버튼 height | 48px | 39px | −9px |
| OBSERVE 라벨 height | 17px | 23px | +6px |

**원인 추정**: input의 `py-3`(12px) 패딩이 적용됐다고 가정했으나 실측 height 20px = 폰트 line-height만. Tailwind v4 preflight + browser default 충돌 가능성. 진단 deep-dive 필요.

### 2.2 Vertical 위치 시프트 (카테고리 B)

| Element | Δ y |
|---|---|
| 입실 헤딩 | +7px |
| 관·응·대 (좌하단 tagline) | **+58px** |
| 날짜 (우하단) | +60px |
| 계정 인증 헤딩 | **+101px** |
| Microsoft SSO 버튼 | +53px |
| "또는 이메일로 로그인" divider | +23px |
| 입실 버튼 | −69px |
| MS-2026-042 푸터 | **−121px** |

**원인 추정**: 콘텐츠가 평균 50–100px 아래로 시프트되고 푸터는 위로 올라옴. brand panel `justify-between`의 작동 영역, auth panel `justify-center`의 작동 영역이 mockup 대비 작음 = 1fr row(940px)가 자식 panel에 정확히 전달 안 되는 가능성.

### 2.3 Horizontal 시프트 (카테고리 C)

| Element | Δ x |
|---|---|
| 입실 헤딩 | −40px (panel 좌측 가장자리에 닿음) |
| OBSERVE | −40px |
| 관·응·대 | −40px |

**원인 추정**: `lg:px-7`(40px) 적용 표시되지만 측정값은 0px = brand panel padding-left가 자식 element에 안 닿음. brand-center 또는 다른 inner wrapper가 padding을 흡수.

### 2.4 환경 차이 (수정 불가, 허용 영역)

- Pretendard 폰트 anti-aliasing
- Washi 노이즈 SVG turbulence 미세 차이
- 브라우저 default subpixel rendering

## 3. 수정 접근법

**선택**: 카테고리별 incremental fix (대안: page.tsx 폐기 후 mockup HTML 재포팅 — 인증 Server Action 등 React 로직 다시 wiring 비용이 격차 좁히는 비용보다 큼)

**카테고리별 단계**:

1. **[A] Input/Button 크기** — Field input의 `py-3` 미적용 원인 dev tools 진단 → mockup CSS(`padding: 12px 0`, line-height 1.5 inherit) 정확 매칭. 입실 버튼 `min-h-12`(48px) 검증
2. **[C] Horizontal 시프트** — brand panel padding이 자식에 안 닿는 원인 식별 후 정확 일치까지
3. **[B] Vertical 시프트** — main 행 높이 940px 자식 panel 전달 검증, brand `justify-between` / auth `justify-center` 정상 작동
4. **누적 회귀 검증** — 모든 카테고리 fix 후 재측정 + e2e 회귀 가드

## 4. Architecture & Step 분해

### 4.1 수정 파일

- **주**: `src/app/login/page.tsx` (BrandPanel / AuthPanel / Field / SSOButton / TitleBar / StatusBar)
- **보조**: `src/app/globals.css` (input/button 공통 base 스타일이 필요한 경우)
- **미수정**: 인증 로직(`features/auth/*`), `design-tokens.ts`, `layout.tsx`, `middleware.ts`

### 4.2 Step (sequential)

| # | Step | 산출물 | 검증 |
|---|---|---|---|
| 1 | Diagnostic deep-dive | 진단 노트 (각 격차의 root cause CSS 라인) | 코드 변경 없음. fix 방향 명확화 |
| 2 | Category A fix (Input/Button 크기) | input height 39, 버튼 48 매칭 | `diagnose-layout.mjs`에서 input/button 좌표·크기 매칭 |
| 3 | Category C fix (Horizontal 시프트) | brand 자식 element들 panel padding 일관 적용 | `diagnose-layout.mjs`에서 입실 헤딩/OBSERVE/관·응·대 Δx ≈ 0 |
| 4 | Category B fix (Vertical 시프트) | main row → panel 940px 전달, justify-between/center 정상 | `diagnose-layout.mjs`에서 모든 element Δy < 5px |
| 5 | Final validation + 회귀 검증 | 종합 검증 (§5 testing 항목 전부 green) | 사용자 시각 인정 |

### 4.3 의존성

- Step 1 → 2/3/4 (deep-dive 결과로 fix 방향 결정)
- Step 2/3/4는 카테고리 독립적이지만 sequential 진행 (회귀 발견 빠름)
- Step 5는 모든 fix 완료 후

### 4.4 Risk + Mitigation

| Risk | Mitigation |
|---|---|
| Category B(vertical shift)가 단순 padding 아닌 layout 구조 문제 | Step 1에서 root cause 명확화. structural 문제면 plan revise |
| Input height issue가 Tailwind v4 preflight + browser default 충돌 | `globals.css`에 input base 명시 (mockup CSS 미러링) 옵션 |
| Fix 후 sync 97% 미달 (font/SVG 환경 차이만으로 6%+ 가능) | 환경 차이는 §2.4에서 허용 영역으로 명시 |

## 5. Testing 정책

| 검증 | 도구 | 임계 |
|---|---|---|
| 정량 (좌표) | `node scripts/diagnose-layout.mjs` | 14 element 전부 Δx < 5px **AND** Δy < 5px |
| 정량 (픽셀) | `npm run design-sync` (login desktop) | **sync 97%+** (현재 94.4%) |
| 정량 (코드) | `tsc --noEmit` / `lint` / `next build` | 모두 exit 0 |
| 회귀 (인터랙션) | `npm test` (Vitest 6) + `npm run test:e2e` (Playwright 40) | 모두 pass / 0 fail |
| 정성 (사용자 시각) | mockup HTML ↔ Folio /login 동시 띄워 시각 검증 | 사용자가 *"동일하다고 인정"* |

**신규 test 추가 없음** — 이번 plan은 fix-only. layout 검증은 `diagnose-layout.mjs`로 충분.

## 6. 산출물

1. 이 design.md → `design-ref/2026-04-26-login-refinement-design.md`
2. plan.md → `design-ref/2026-04-26-login-refinement-plan.md` (writing-plans 스킬 산출)
3. 코드 변경 → `src/app/login/page.tsx` (주), `src/app/globals.css` (필요 시)
4. 진단 도구 → `scripts/diagnose-layout.mjs` (이미 작성됨, plan 진행 중 재사용)
5. 메모리 → fix 패턴 발견 시 `feedback_layout_debugging.md` (dashboard plan에서 재사용)

## 7. Out of Scope

- 컴포넌트 추출 (`src/components/common/`) — dashboard plan에서 함께 검토 (3+ uses 규칙)
- Microsoft SSO 실연결 — 별도 plan (Azure AD provider 설정 필요)
- 다크 모드 — mockup이 라이트 전용
- 추가 페이지 (/forgot-password 등) — 현재 mockup에 없음

## 8. 다음 단계

- **이 plan 종료 후** → Dashboard reconstruction brainstorm + plan (사용자 표현 *"사실상 다른 앱"* 격차)
  - 구조 재구성 + 컴포넌트 추출 검토 포함
  - login에서 잡힌 패턴(seal / field / button 등)을 dashboard inspector·doc-row·ins-btn에 재사용

---

## 부록 A: Diagnostic 결과 (Task 1)

**측정 도구:** `scripts/diagnose-layout.mjs`(좌표) + `scripts/diagnose-computed.mjs`(computed style, Task 1에서 작성).
**측정 환경:** viewport 1366×900, mockup `file://design-ref/folio-login.html` ↔ `http://localhost:3001/login`.

### 핵심 발견 — 1·2차 root cause는 카테고리 A/B/C 모두 공유

진단 중 카테고리별로 분리해 측정했으나 **세 카테고리 모두 동일한 두 개의 globals.css 버그에서 파생**됨이 확인됨. 격차 분류는 증상별이고, 수정은 globals.css 두 줄로 끝난다.

**Bug 1 — 글로벌 `*` 리셋이 unlayered로 선언되어 Tailwind utilities를 override:**

전제: `src/app/globals.css` line 2 `@import "tailwindcss";`가 utilities를 `@layer utilities` 안에 배치한다. CSS Cascade Layers spec에 따르면 unlayered 선언은 모든 layered 선언을 specificity와 무관하게 이긴다. 따라서 `@layer` 밖에 있는 `*` 리셋은 specificity 0,0,0,1로도 `@layer utilities`의 모든 utility를 cascade에서 패배시킨다.

`src/app/globals.css` line 141-145:
```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
```

이 규칙이 `@layer` 밖에 있어서 `@layer utilities` 안의 `.py-3 { padding-block: var(--space-3) }`, `.lg:py-8`, `.mb-5`, `.mt-1`, `.px-4`, `.lg:px-7` 등 **모든 padding/margin 유틸리티를 cascade에서 패배시킴**. CSS Cascade Layer 규칙: unlayered 선언은 모든 layered 선언을 이긴다. 결과적으로 `py-3`(input), `lg:px-7`(brand panel), `lg:py-8`(brand/auth panel), `mb-5`(h1) 등이 전부 무력화.

검증 (Playwright `getComputedStyle`):
- 빈 `<div class="py-3">`: `padding-top=0px, padding-bottom=0px` (기대 12px)
- `<h1 class="mb-5">`: `margin-bottom=0px` (기대 20px)
- `<aside class="lg:py-8 lg:px-7">`: `padding=0` (기대 56px / 40px)
- `<input class="py-3">`: `padding=0`, height 19.5px (line-height만 — 기대 39px)
- 대조군: `gap-4`(reset에 없음) → 16px ✓ 정상 작동

**Bug 2 — `html`의 font-size가 13px로 설정되어 rem-기반 utility가 19% 작아짐:**

`src/app/globals.css` line 147-159:
```css
html, body {
  ...
  font-size: var(--text-md);  /* = 13px */
  ...
}
```

`html`에도 13px이 적용되어 `1rem = 13px`. Tailwind v4의 `min-h-12`는 `min-height: calc(var(--spacing) * 12) = calc(.25rem * 12) = 3rem`이므로 **3 × 13 = 39px** (mockup 48px 대비 −9px).

검증:
- `<button class="min-h-12">`(SubmitButton, SSOButton): height = 39px (기대 48px)
- `<html>` computed `font-size`: 13px (기본 16px 어야 함)

mockup의 globals은 `html, body { font-size: var(--text-md) }`로 동일하지만, mockup CSS는 Tailwind를 사용하지 않으므로 button이 `min-height: 48px` literal 값으로 정의되어 영향 없음. 우리만 rem 기반 spacing을 쓰므로 여기서 누적 오차.

**Bug 3 — input의 line-height inherit (Task 2 사후 발견):**

Bug 1+2 fix 적용 후 input height가 `padding 12+12+line-height(13×1.5)=43.5 ≈ 44px`로 측정됨. mockup은 39px. 차이 5px의 원인:

- mockup `.field input { line-height: ??? }` 명시 X → browser default `normal` (≈ 1.15) → height = 13 × 1.15 + 24 = ~39 ✓
- 우리 `<input>` Tailwind v4 preflight: `button, input, ... { font: inherit; }`로 body의 `line-height: 1.5` inherit → height = 13 × 1.5 + 24 = ~44

**Fix**: `src/app/login/page.tsx` `<Field>` 컴포넌트의 `<input>` className에 `[line-height:normal]` 추가. (Tailwind `leading-none`(1.0)은 13+24=37로 mockup -2 underflow, `[line-height:normal]`이 mockup과 동일.)

검증 후 input 매칭: `420×39` ✓ (Δy 잔여 -4 ~ -6 — Cat B 영역).

### Category A (input/button 크기)
- **Root cause**: Bug 1 + Bug 2 합산. (1) `py-3`(input의 `padding-block: 12px`)이 `* { padding: 0 }` 리셋에 막혀 input height가 padding 12px+12px+line-height 20px = 44px 대신 line-height만의 20px이 됨 (mockup 39px 대비 −19px). (2) `min-h-12`(SSO/SubmitButton의 `min-height: 3rem`)이 html font-size 13px 컨텍스트에서 `3rem = 39px`로 계산됨 (mockup 48px 대비 −9px).
- **Fix 방향**:
  - **`src/app/globals.css` line 141-145의 `*` 리셋을 `@layer base` 안으로 이동**:
    ```css
    @layer base {
      * { box-sizing: border-box; margin: 0; padding: 0; }
    }
    ```
    이렇게 하면 utilities layer(더 후순위)가 padding/margin을 정상 override.
  - **`src/app/globals.css` line 147-159의 `html` selector에서 font-size를 분리**:
    `html, body { font-size: var(--text-md) }` 대신 `body { font-size: var(--text-md) }`로 두어 `html`이 브라우저 기본 16px 유지하도록 함. 이렇게 해야 `min-h-12 = 3rem = 48px`로 정확. (mockup HTML도 `html, body` 함께 13px이지만 mockup은 rem 기반 spacing이 없어 영향 없음 — 우리는 Tailwind를 쓰므로 분리 필요.)
  - 코드(`src/app/login/page.tsx`)는 변경 불필요 — `Field`의 `py-3`, `SubmitButton`/`SSOButton`의 `min-h-12`는 의도대로 작성되어 있고 globals.css 수정만으로 정확히 적용됨.

### Category B (vertical 시프트)
- **Root cause**: Bug 1 단독. `<aside>` brand panel과 `<section>` auth panel 모두 `py-5 px-4 md:py-6 md:px-5 lg:py-8 lg:px-7` 가 있으나 `* { padding: 0 }` 리셋에 막혀 **컴퓨티드 padding이 모두 0px** (mockup brand `padding: 56px 40px` 대비). 결과적으로 brand의 `justify-between`이 panel content를 0–840px 전체에 펼치고(mockup은 56–784px에 분산), auth의 `justify-center`도 0–840px 안에서 자식을 중앙배치(mockup은 56–784px). 이 상하 56px 패딩 부재가 모든 vertical 시프트의 산술적 원인 (관·응·대 +58px / 계정 인증 +101px / SSO +53px / 입실 버튼 −69px / 푸터 −121px). h1 `mb-5`(20px), h2 `mb-2`(8px), p `mb-6`(28px) 등 mb-* 유틸 무력화도 누적 기여.
- **Fix 방향**: Category A의 globals.css fix(Bug 1 — `*` 리셋을 `@layer base`로 이동)로 자동 해결. brand/auth panel의 `lg:py-8 lg:px-7`이 정상 적용되면 mockup 56/40 padding이 살아나 panel 자식 vertical 정렬이 정확. **`src/app/login/page.tsx` 변경 불필요**. 추가로 button `min-h-12`(48px) 정상화로 auth panel content 총 높이가 mockup과 정확 일치.

### Category C (horizontal 시프트)
- **Root cause**: Bug 1 단독. `<aside>` brand panel의 `lg:px-7`(`padding-inline: 40px`)가 `* { padding: 0 }`에 막혀 left padding 0px이 됨. brand-center wrapper, h1, tagline 자체에는 padding/margin이 없으므로 panel 좌측 가장자리(x=0)에 그대로 붙어 mockup 대비 −40px 시프트 (`getComputedStyle` 확인: 우리 aside `padding-left=0px`, mockup `40px`). brand panel과 자식 사이에 추가 div wrapper는 mockup과 동일한 3개(brand-top / brand-center / brand-foot) — DOM 구조 차이는 절대 위치 장식 `<span>`(운영 배경 글자) 1개뿐이고 layout에 영향 없음.
- **Fix 방향**: Category A/B의 globals.css fix(Bug 1)로 자동 해결. `lg:px-7` 정상 적용되면 brand 자식들이 x=40으로 시프트, mockup과 일치. **`src/app/login/page.tsx` 변경 불필요**.

### 종합 — Task 2/3/4에서 적용할 fix

세 카테고리 모두 `src/app/globals.css`의 두 가지 변경으로 해결:

1. `*` 리셋(line 141-145)을 `@layer base { ... }`로 wrap.
2. `html, body { font-size: var(--text-md); ... }`를 `body { font-size: var(--text-md); ... }`로 분리 (html 별도 미선언, 16px 기본 유지).

`src/app/login/page.tsx`는 무수정. 즉 plan의 카테고리별 incremental fix 분리를 유지하되 — Task 2(A)에서 globals.css 두 줄 패치 + 측정 → A/B/C 좌표가 동시에 매칭될 가능성 높음. Task 3(C), Task 4(B)는 Task 2 직후 측정에서 잔존 격차 있는 element만 미세 조정으로 마무리.
