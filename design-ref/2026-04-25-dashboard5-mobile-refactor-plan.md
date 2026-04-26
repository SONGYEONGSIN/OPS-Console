# dashboard5 모바일 반응형 리팩토링 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `dashboard5.html`을 360px부터 1440px+까지 대응하는 반응형 대시보드로 리팩토링한다. 와시(washi) 에디토리얼 시각 정체성은 유지한다.

**Architecture:** 단일 HTML 파일 내 인라인 CSS/JS 구조를 유지하면서 (1) CSS 토큰화, (2) 4단계 브레이크포인트(1280/1024/768/480/360), (3) 사이드바·인스펙터 양쪽 드로어화, (4) 모바일 전용 앱바 DOM 추가, (5) 드로어 토글·포커스 트랩·스와이프 닫기 JS 로직을 추가한다.

**Tech Stack:** HTML5, CSS3 (Custom Properties, `@media`, `grid`, `position: fixed` + `transform`), Vanilla JS (PointerEvents, matchMedia, focus 관리)

**Spec 참조:** `docs/superpowers/specs/2026-04-25-dashboard5-mobile-refactor-design.md`

**비고:** 
- 작업 디렉토리는 git 저장소가 아니므로 "commit" 단계는 "체크포인트(수동 저장)"로 대체한다.
- 테스트 프레임워크가 없으므로 검증은 **브라우저 뷰포트 육안 확인** + **상호작용 체크리스트**로 수행한다.
- 각 태스크 완료 후 `open dashboard5.html` (또는 Chrome DevTools Device Toolbar)로 확인한다.

---

## File Structure

- **Modify**: `/Users/yss/개발/skill/dashboard5.html` (단일 대상)
- **Reference**: `/Users/yss/개발/skill/docs/superpowers/specs/2026-04-25-dashboard5-mobile-refactor-design.md`

dashboard5.html 내부 구조 (태스크에서 참조할 앵커):
- `<style>` line 8 — 인라인 스타일시트
- `:root` 토큰 블록 line 9–26
- `/* TITLE BAR */` line 69 / `/* MENU BAR */` line 121 / `/* DROPDOWN */` line 233
- `/* MAIN LAYOUT */` line 305 / `/* SIDEBAR */` line 312 / `/* CONTENT */` line 475
- `/* INSPECTOR */` line 796 / `/* STATUS BAR */` line 1004
- 기존 `@media` 블록 line 1042–1051 (제거·교체 대상)
- `<body>` line 1054, `<div class="app">` line 1055
- `<aside class="sidebar">` line 1283, `<main class="content">` line 1387, `<aside class="inspector">` line 1521, `<div class="statusbar">` line 1604
- `<script>` line 1623–1695 (기존 JS, 확장 대상)

---

## 검증 절차 (공통)

각 태스크 종료 시:
1. 파일 저장 후 브라우저에서 `dashboard5.html`을 새로고침
2. Chrome DevTools → Device Toolbar(Cmd+Shift+M) 열기
3. 태스크에 명시된 뷰포트 폭으로 확인

뷰포트 프리셋 (자주 사용):
- **1440 × 900** — 데스크탑 풀
- **1280 × 800** — 데스크탑 기본
- **1024 × 768** — 데스크탑 축약 / iPad landscape
- **820 × 1180** — iPad portrait
- **414 × 896** — iPhone 11 Pro Max
- **390 × 844** — iPhone 14
- **360 × 740** — Galaxy S20 / SE 대응 기준선

---

## Tasks

### Task 1: CSS 토큰 추가 (text / space / tap)

**Files:**
- Modify: `dashboard5.html` — `:root` 블록 (line 9–26 직후)

- [ ] **Step 1: `:root` 블록 끝(line 25 앞, `--sage: #556b2f;` 다음 라인)에 토큰 섹션 추가**

`:root` 블록 닫는 `}` 직전에 다음 변수들을 추가한다.

```css
    /* ---- Typography scale ---- */
    --text-xs:  11px;
    --text-sm:  12px;
    --text-md:  13px;
    --text-lg:  15px;
    --text-xl:  20px;
    --text-2xl: 26px;

    /* ---- Spacing scale ---- */
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 20px;
    --space-6: 28px;

    /* ---- Touch target ---- */
    --tap-min: 36px;

    /* ---- Motion ---- */
    --drawer-ease: cubic-bezier(0.2, 0.0, 0.2, 1);
    --drawer-ms: 250ms;
```

- [ ] **Step 2: `<style>` 블록 상단(line 8 `<style>` 직후) 바로 아래에 모바일 토큰 오버라이드 블록 추가**

`:root { ... }` 닫힘 다음 라인에 아래 블록을 추가한다 (`* { box-sizing... }` 선언 이전).

```css
  @media (max-width: 767px) {
    :root {
      --text-md: 14px;
      --text-xl: 18px;
      --text-2xl: 22px;
      --tap-min: 44px;
      --drawer-ms: 220ms;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :root {
      --drawer-ms: 120ms;
    }
  }
```

- [ ] **Step 3: 브라우저 검증**

`dashboard5.html`을 새로고침. 기존 레이아웃이 **변함없이 렌더링**되어야 한다 (토큰만 추가, 아직 사용 안 함). DevTools Elements → `:root` 계산 스타일에 `--text-md`, `--tap-min` 등이 표시되는지 확인.

- [ ] **Step 4: 체크포인트**

시각적 회귀 없음을 확인. 파일 저장.

---

### Task 2: 반응형 스캐폴드 — 기존 `@media` 제거 후 4단 규칙 블록 생성

**Files:**
- Modify: `dashboard5.html` — 기존 line 1042–1051 (교체)

- [ ] **Step 1: 기존 `@media` 블록 제거**

line 1042–1051의 아래 블록을 찾는다.

```css
  /* Responsive */
  @media (max-width: 1100px) {
    .main { grid-template-columns: 200px 1fr 260px; }
    .doc-list-head, .doc-row { grid-template-columns: 26px 2fr 100px 100px 80px; }
    .doc-list-head > div:nth-child(5), .doc-row > div:nth-child(5) { display: none; }
  }
  @media (max-width: 860px) {
    .main { grid-template-columns: 1fr; }
    .sidebar, .inspector { display: none; }
  }
```

- [ ] **Step 2: 위 블록을 아래 4단 스캐폴드로 교체**

```css
  /* ============== RESPONSIVE ============== */
  /* Tier 1: 데스크탑 축약 (1024–1279) */
  @media (max-width: 1279px) {
    .main { grid-template-columns: 200px 1fr 260px; }
    .doc-list-head, .doc-row { grid-template-columns: 26px 2fr 100px 100px 80px; }
    .doc-list-head > div:nth-child(5), .doc-row > div:nth-child(5) { display: none; }
  }

  /* Tier 2: 태블릿 (768–1023) — 인스펙터 드로어 */
  @media (max-width: 1023px) {
    /* Placeholder — Task 3에서 채움 */
  }

  /* Tier 3: 모바일 와이드 (480–767) — 양쪽 드로어 */
  @media (max-width: 767px) {
    /* Placeholder — Task 5 이후 채움 */
  }

  /* Tier 4: 모바일 콤팩트 (≤479) */
  @media (max-width: 479px) {
    /* Placeholder — Task 7 이후 채움 */
  }
```

- [ ] **Step 3: 브라우저 검증 — 1440px, 1280px**

두 폭에서 현재 데스크탑과 동일하게 보여야 한다 (회귀 없음).

- [ ] **Step 4: 브라우저 검증 — 1024px**

사이드바 200px, 인스펙터 260px, 서비스 목록 "최근 이벤트" 열이 숨겨지는지 확인. 기존 1100 규칙이 1279 규칙으로 상향 조정됐으므로, 1100~1279 구간은 이제 축약 레이아웃이 적용된다.

- [ ] **Step 5: 체크포인트**

---

### Task 3: 태블릿 뷰 (≤1023) — 인스펙터 드로어화 + 토글 버튼

**Files:**
- Modify: `dashboard5.html` — `<main class="content">` 내부 (line 1387 부근), Tier 2 `@media` 블록

- [ ] **Step 1: 인스펙터에 id 부여**

line 1521 `<aside class="inspector">`를 아래로 교체.

```html
    <!-- INSPECTOR -->
    <aside class="inspector" id="inspector" role="complementary" aria-labelledby="inspector-title">
```

그리고 line 1527 `<h2>결제 게이트웨이</h2>`를 아래로 교체.

```html
        <h2 id="inspector-title">결제 게이트웨이</h2>
```

- [ ] **Step 2: 인스펙터 헤더에 닫기 버튼 추가**

line 1521의 `<aside class="inspector" id="inspector"...>` 바로 다음 라인, `<div class="ins-head">` 직전에 아래를 삽입.

```html
      <button class="drawer-close" data-close="inspector" aria-label="인스펙터 닫기" type="button">×</button>
```

- [ ] **Step 3: 콘텐츠 헤드에 `[상세 ▸]` 토글 버튼 추가 (태블릿 이하에서만 표시)**

line 1414–1415 사이, `</div>` (content-head 닫힘) 뒤, `<div class="toolbar">` 바로 앞에 추가. 정확히는 toolbar 안 왼쪽 영역에 넣는 편이 자연스럽다. `<div class="toolbar-left">` 내부의 마지막 `</div>` (filter-chips 닫힘) 다음 라인에 다음을 삽입한다.

line 1417–1428 부근의 `<div class="toolbar-left">...</div>` 블록에서 `filter-chips` 닫힘 `</div>` 다음에 추가한다.

```html
          <button class="btn-inspector-toggle" type="button"
                  aria-expanded="false" aria-controls="inspector" disabled>
            <span class="kr">상세</span> ▸
          </button>
```

- [ ] **Step 4: 닫기 버튼과 토글 버튼의 기본 스타일을 `/* INSPECTOR */` 섹션(line 796) 하단에 추가**

```css
  .drawer-close {
    display: none;
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid var(--line-soft);
    border-radius: 50%;
    color: var(--ink);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    z-index: 2;
  }
  .drawer-close:hover {
    background: var(--washi-raised);
  }

  .btn-inspector-toggle {
    display: none;
    align-items: center;
    gap: 4px;
    min-height: var(--tap-min);
    padding: 0 var(--space-3);
    background: transparent;
    border: 1px solid var(--line-soft);
    color: var(--ink);
    font-family: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }
  .btn-inspector-toggle:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn-inspector-toggle[aria-expanded="true"] {
    background: var(--washi-raised);
  }
```

- [ ] **Step 5: Tier 2 `@media (max-width: 1023px)` 블록을 아래 내용으로 채움**

```css
  @media (max-width: 1023px) {
    .main {
      grid-template-columns: 200px 1fr;
    }
    .inspector {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(92vw, 360px);
      z-index: 40;
      transform: translateX(100%);
      transition: transform var(--drawer-ms) var(--drawer-ease);
      box-shadow: -8px 0 24px rgba(21, 18, 12, 0.08);
      overflow-y: auto;
    }
    .inspector.open {
      transform: translateX(0);
    }
    .drawer-close { display: inline-flex; align-items: center; justify-content: center; }
    .btn-inspector-toggle { display: inline-flex; }
    body { overflow-y: auto; height: auto; }
    .app { height: auto; min-height: 100vh; }
    .doc-list-head, .doc-row { grid-template-columns: 26px 2fr 110px 90px; }
    .doc-list-head > div:nth-child(5), .doc-row > div:nth-child(5),
    .doc-list-head > div:nth-child(6), .doc-row > div:nth-child(6) { display: none; }
  }
```

- [ ] **Step 6: 브라우저 검증 — 1024px**

1024px는 Tier 1 규칙 적용 (사이드바 200, 인스펙터 260 grid 안). 변화 없어야 함.

- [ ] **Step 7: 브라우저 검증 — 820px (iPad portrait)**

- 인스펙터는 화면 오른쪽 밖으로 밀려나 보이지 않음
- 서비스 목록 위쪽 툴바에 `[상세 ▸]` 버튼이 표시됨 (단, 비활성 상태)
- 사이드바는 여전히 좌측에 200px로 고정 표시

- [ ] **Step 8: 체크포인트**

인스펙터 토글 로직(JS)은 아직 없음. 현재는 CSS만 적용. 토글은 Task 10에서 구현.

---

### Task 4: 모바일 전용 DOM 추가 — 앱바 · 스크림 · 사이드바 닫기

**Files:**
- Modify: `dashboard5.html` — `<div class="app">` 내부 (line 1055 부근)

- [ ] **Step 1: 사이드바에 id + 닫기 버튼 추가**

line 1283 `<aside class="sidebar">`를 다음으로 교체.

```html
    <!-- SIDEBAR -->
    <aside class="sidebar" id="sidebar" role="navigation" aria-labelledby="sidebar-title">
      <button class="drawer-close" data-close="sidebar" aria-label="메뉴 닫기" type="button">×</button>
      <h2 class="sr-only" id="sidebar-title">운영실 메뉴</h2>
```

- [ ] **Step 2: 앱바 + 스크림 DOM 삽입**

line 1055 `<div class="app">` 다음 라인 (현재 line 1056부터가 comment "============ TITLE BAR ============"), 즉 `<!-- ============ TITLE BAR ============ -->` 주석 **앞**에 아래 블록을 삽입한다.

```html
  <!-- ============ MOBILE APP BAR (≤767px only) ============ -->
  <header class="appbar" role="banner">
    <button class="btn-hamburger" type="button"
            aria-label="메뉴 열기" aria-expanded="false" aria-controls="sidebar">
      <span aria-hidden="true">☰</span>
    </button>
    <div class="appbar-title">
      <span class="kr">운영실</span> <em>·</em> <span class="label-en">OPSROOM</span>
    </div>
    <button class="btn-notif" type="button" aria-label="알림 3건">
      <span aria-hidden="true">✉</span><sup>3</sup>
    </button>
    <span class="appbar-led" role="status" aria-label="연결됨"></span>
    <button class="btn-inspector-mobile" type="button"
            aria-label="상세 보기" aria-expanded="false" aria-controls="inspector" disabled>
      <span class="kr">상세</span> ▸
    </button>
  </header>

  <!-- ============ DRAWER SCRIM ============ -->
  <div class="scrim" data-drawer-scrim aria-hidden="true"></div>
```

- [ ] **Step 3: `sr-only` 유틸리티 클래스를 `<style>` 상단(첫 `* { box-sizing... }` 직전)에 추가**

```css
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
```

- [ ] **Step 4: 브라우저 검증 — 1440px**

데스크탑에서는 아직 앱바가 스타일 없이 노출될 수 있다. 현재는 DOM만 추가한 상태이므로 다음 태스크(Task 5)에서 `display: none`으로 숨긴다. 이 단계에서는 레이아웃이 약간 어긋나도 괜찮다.

- [ ] **Step 5: 체크포인트**

---

### Task 5: 앱바 / 스크림 기본 스타일 (데스크탑 숨김)

**Files:**
- Modify: `dashboard5.html` — `<style>` 하단 (RESPONSIVE 블록 위)

- [ ] **Step 1: `/* STATUS BAR */` 섹션(line 1004) 종료 후, RESPONSIVE 블록 앞에 아래 섹션을 추가**

```css
  /* ============== MOBILE APP BAR ============== */
  .appbar {
    display: none;
    align-items: center;
    gap: var(--space-2);
    height: 48px;
    padding: 0 var(--space-3);
    background: var(--washi);
    border-bottom: 1px solid var(--line);
    position: relative;
    z-index: 30;
  }
  .appbar-title {
    flex: 1;
    text-align: center;
    font-size: var(--text-md);
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .appbar-title em {
    font-style: normal;
    color: var(--vermilion);
    margin: 0 2px;
  }
  .appbar-title .label-en {
    color: var(--muted);
    font-size: var(--text-sm);
  }
  .btn-hamburger,
  .btn-notif,
  .btn-inspector-mobile {
    min-width: var(--tap-min);
    min-height: var(--tap-min);
    padding: 0 var(--space-2);
    background: transparent;
    border: 1px solid var(--line-soft);
    color: var(--ink);
    font-family: inherit;
    font-size: var(--text-md);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .btn-notif sup {
    color: var(--vermilion);
    font-size: var(--text-xs);
    margin-left: 2px;
  }
  .btn-inspector-mobile:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .appbar-led {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--sage);
    box-shadow: 0 0 6px var(--sage);
  }

  /* ============== DRAWER SCRIM ============== */
  .scrim {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(21, 18, 12, 0.35);
    z-index: 35;
    opacity: 0;
    transition: opacity var(--drawer-ms) var(--drawer-ease);
  }
  .scrim.open {
    display: block;
    opacity: 1;
  }
```

- [ ] **Step 2: 브라우저 검증 — 1440px**

앱바가 완전히 숨김(`display: none`). 데스크탑 레이아웃 회귀 없음 확인.

- [ ] **Step 3: 브라우저 검증 — 390px**

이 시점에서 앱바는 아직 `display: none`이다 (Tier 3에서 활성화). 390px에서는 기존 데스크탑 크롬이 좁게 눌려 있을 것. 이건 Task 6에서 해결됨.

- [ ] **Step 4: 체크포인트**

---

### Task 6: Tier 3 모바일 (≤767) — 기본 레이아웃, 앱바 노출, 데스크탑 크롬 숨김

**Files:**
- Modify: `dashboard5.html` — Tier 3 `@media (max-width: 767px)` 블록

- [ ] **Step 1: 기존 Tier 3 placeholder를 다음으로 교체**

```css
  @media (max-width: 767px) {
    .appbar { display: flex; }
    .titlebar { display: none; }
    .menubar { display: none; }
    /* 태블릿 전용 인스펙터 토글은 모바일에선 숨김 (앱바에 .btn-inspector-mobile 존재) */
    .btn-inspector-toggle { display: none !important; }

    /* 모바일에선 titlebar/menubar 숨김 + statusbar fixed → grid 플로우 아이템은 appbar + main뿐 */
    .app {
      grid-template-rows: 48px 1fr;
    }

    .main {
      grid-template-columns: 1fr;
    }

    /* 사이드바 드로어 */
    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: min(84vw, 300px);
      z-index: 40;
      transform: translateX(-100%);
      transition: transform var(--drawer-ms) var(--drawer-ease);
      box-shadow: 8px 0 24px rgba(21, 18, 12, 0.08);
      overflow-y: auto;
      padding-top: var(--space-5);
    }
    .sidebar.open {
      transform: translateX(0);
    }

    /* 인스펙터 드로어는 Tier 2 규칙 재사용 (이미 fixed) */

    /* 콘텐츠 풀 폭 + 세로 스크롤 */
    .content {
      overflow: visible;
    }

    /* 탭 바 가로 스크롤 */
    .crumb-bar {
      flex-direction: column;
      align-items: stretch;
      padding: 0;
    }
    .tabs {
      overflow-x: auto;
      scrollbar-width: thin;
      padding: 0 var(--space-3);
      gap: var(--space-2);
    }
    .tabs::-webkit-scrollbar { height: 3px; }
    .tabs::-webkit-scrollbar-track { background: var(--washi-raised); }
    .tabs::-webkit-scrollbar-thumb { background: var(--line-soft); border-radius: 2px; }
    .tab {
      flex-shrink: 0;
      max-width: 160px;
      font-size: var(--text-sm);
    }
    .tab:last-child { position: sticky; right: 0; background: var(--washi); }

    /* 크럼 */
    .crumb {
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-xs);
    }

    /* 툴바 — 버튼 스택 */
    .toolbar {
      flex-wrap: wrap;
      gap: var(--space-2);
      padding: var(--space-3);
    }
    .toolbar-left {
      flex-wrap: wrap;
      gap: var(--space-2);
      width: 100%;
    }
    .filter-chips {
      overflow-x: auto;
      scrollbar-width: none;
    }
    .filter-chips::-webkit-scrollbar { display: none; }
    .view-switch {
      width: 100%;
      justify-content: flex-end;
    }

    /* 스크림이 드로어 뒤로 들어가지 않도록 */
    .scrim { z-index: 35; }
  }
```

- [ ] **Step 2: 브라우저 검증 — 390px**

다음 항목을 확인한다:
- 상단에 앱바(48px)가 표시되고 `☰ 운영실 · OPSROOM ✉³ ● 상세 ▸`가 보임
- 타이틀바(macOS 창 컨트롤)와 메뉴바는 숨김
- 콘텐츠(크럼, 툴바, 서비스 목록)가 전체 폭 차지
- 사이드바와 인스펙터는 화면 밖(아직 drawer open 상태 아님)
- 세로 스크롤로 모든 서비스 행을 볼 수 있음 (단, 행 스타일은 아직 데스크탑 테이블 형태)

- [ ] **Step 3: 브라우저 검증 — 1440px**

앱바 숨김, 데스크탑 크롬 정상, 회귀 없음.

- [ ] **Step 4: 체크포인트**

---

### Task 7: 서비스 목록 축약 리스트 (≤767)

**Files:**
- Modify: `dashboard5.html` — Tier 3 `@media` 블록 내부

- [ ] **Step 1: Tier 3 블록 끝(`/* 스크림이... */` 블록 앞)에 아래 규칙들을 추가**

CSS Grid는 같은 cell에 여러 아이템을 두면 겹쳐진다. 따라서 모바일에서는 `.doc-row`를 `display: block`으로 되돌리고, 아이콘·상태 배지는 절대 위치, 이름은 블록, 메타(4~6번째)는 인라인 흐름으로 배치한다.

```css
    /* 서비스 목록 — 축약 리스트 (모바일) */
    .doc-list-head { display: none; }

    .doc-row {
      display: block;
      position: relative;
      padding: var(--space-3) var(--space-3) var(--space-3) calc(40px + var(--space-3) * 2);
      min-height: 64px;
      border-bottom: 1px solid var(--line-soft);
      cursor: pointer;
      grid-template-columns: none;  /* 데스크탑 grid 규칙 해제 */
    }

    /* 아이콘 — 좌측 절대 배치 */
    .doc-row > .doc-ico {
      position: absolute;
      left: var(--space-3);
      top: 50%;
      transform: translateY(-50%);
      width: 32px;
      height: 32px;
      font-size: var(--text-sm);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* 이름 — 상단 블록, 우측에 상태 배지 공간 확보 */
    .doc-row > .doc-name {
      display: block;
      margin-bottom: 2px;
      padding-right: 60px;
      font-size: var(--text-md);
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .doc-row > .doc-name small { display: none; }

    /* 상태 배지 — 우상단 절대 배치 */
    .doc-row > div:nth-child(3) {
      position: absolute;
      right: var(--space-3);
      top: var(--space-3);
    }

    /* 메타 (4~6번째) — 인라인 흐름 */
    .doc-row > .doc-meta,
    .doc-row > .doc-tags {
      display: inline;
      font-size: var(--text-xs);
      color: var(--muted);
    }
    .doc-row > .doc-meta::after {
      content: " · ";
      color: var(--faint);
    }
    .doc-row > .doc-tags::before {
      content: " · ";
      color: var(--faint);
    }

    /* 좌측 세로 띠 — 장애/주의 */
    .doc-row:has(.doc-status.urgent)::before,
    .doc-row:has(.doc-status.draft)::before {
      content: "";
      position: absolute;
      left: 0;
      top: 8px;
      bottom: 8px;
      width: 2px;
    }
    .doc-row:has(.doc-status.urgent)::before { background: var(--vermilion); }
    .doc-row:has(.doc-status.draft)::before { background: var(--gold); }

    /* 선택 상태 */
    .doc-row.selected {
      background: var(--washi-raised);
    }
```

참고: `:has()` 셀렉터는 Chrome 105+ / Safari 15.4+ / Firefox 121+ 지원. 본 프로젝트 호환 범위(iOS Safari 14+, Chrome Android 90+)와 겹치지 않는 구형 환경에서는 띠가 표시되지 않을 수 있다. 이는 강등(degradation)으로 허용 — 상태 배지는 여전히 우상단에 명확히 표시됨.

- [ ] **Step 2: Tier 4(≤479) 블록에 추가 축약 규칙**

기존 `@media (max-width: 479px)` placeholder를 다음으로 교체.

```css
  @media (max-width: 479px) {
    .appbar-title .label-en { display: none; }
    .titlebar .window-ctrls { display: none; }  /* 태블릿 이상에서 혹시 다시 보여도 숨김 */

    /* 서비스 목록 — "최근 이벤트"(5번째) 완전 숨김 */
    .doc-row > div:nth-child(5) { display: none; }
    .doc-row > div:nth-child(4)::after { content: ""; }
  }
```

- [ ] **Step 3: 브라우저 검증 — 390px**

- 서비스 목록이 2줄 리스트로 변환됨 (상단: 아이콘 + 서비스명 + 상태배지 / 하단: 담당·이벤트·분류)
- `결제 게이트웨이`와 `알림 큐`에는 좌측에 세로 붉은 띠
- `Redis 캐시 클러스터`에는 금색 띠
- `회원 서비스`, `배치 워커`에는 띠 없음
- 행 탭 시 배경이 washi-raised로 바뀜 (기존 `.selected` 로직 살아있음)

- [ ] **Step 4: 브라우저 검증 — 360px**

390px와 동일하되 `최근 이벤트` 항목 숨김 확인.

- [ ] **Step 5: 체크포인트**

---

### Task 8: 인스펙터 모바일 레이아웃 — 헤더 · Sticky 액션바 · 아코디언 CSS

**Files:**
- Modify: `dashboard5.html` — `<aside class="inspector">` 내부 구조 조정, Tier 3 CSS

- [ ] **Step 1: 인스펙터 액션바를 상단으로 옮기는 것이 아니라 CSS sticky로 처리**

현재 `<div class="ins-actions">`는 인스펙터 하단에 위치. DOM은 유지하고 모바일에서만 순서를 CSS `order`로 바꾼다. `.inspector`를 flex container로 전환한다.

Tier 3 블록에 다음 규칙을 추가 (Task 7의 마지막 `.doc-ico` 뒤).

```css
    .inspector {
      display: flex;
      flex-direction: column;
    }
    /*
     * 인스펙터 자식 순서 (Task 3·4 DOM 수정 후):
     *   1: button.drawer-close
     *   2: div.ins-head
     *   3: div.ins-section (속성)
     *   4: div.ins-section (실시간 지표)
     *   5: div.ins-section (담당 · 온콜)
     *   6: div.ins-section (분류 및 의존)
     *   7: div.ins-section (활동 기록)
     *   8: div.ins-actions
     *
     * 모바일 시각 순서: head → actions(sticky) → 실시간 → 담당 → 활동 → 속성(접힘) → 분류(접힘)
     */
    .inspector > .drawer-close { order: -1; }
    .inspector > .ins-head { order: 0; }
    .inspector > .ins-actions {
      order: 1;
      position: sticky;
      top: 0;
      background: var(--washi);
      padding: var(--space-3);
      border-bottom: 1px solid var(--line-soft);
      z-index: 2;
      display: flex;
      gap: var(--space-2);
    }
    .inspector > .ins-section:nth-child(4) { order: 2; } /* 실시간 지표 */
    .inspector > .ins-section:nth-child(5) { order: 3; } /* 담당 · 온콜 */
    .inspector > .ins-section:nth-child(7) { order: 4; } /* 활동 기록 */
    .inspector > .ins-section:nth-child(3) { order: 10; } /* 속성 (접힘) */
    .inspector > .ins-section:nth-child(6) { order: 11; } /* 분류 및 의존 (접힘) */

    .inspector .ins-section h3 {
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .inspector .ins-section h3::before {
      content: "▼";
      font-size: 9px;
      color: var(--muted);
      margin-right: var(--space-2);
      transition: transform 120ms;
    }
    .inspector .ins-section.collapsed h3::before {
      transform: rotate(-90deg);
    }
    .inspector .ins-section.collapsed > *:not(h3) {
      display: none;
    }

    /* 키-값 필드 그리드 축약 */
    .ins-field {
      grid-template-columns: 88px 1fr !important;
    }

    /* 타임라인 시간 줄바꿈 */
    .tl-row .tm {
      display: block;
      margin-top: 2px;
      font-size: 10px;
      color: var(--muted);
    }

    /* 인스펙터 액션 버튼 공평 분배 */
    .inspector .ins-actions .ins-btn {
      flex: 1;
      min-height: var(--tap-min);
    }
```

- [ ] **Step 2: 기본 접힘 클래스를 서버사이드 — 즉 HTML에 직접 마킹**

`<aside class="inspector"...>` 내부의 `<div class="ins-section">` 블록들을 다음과 같이 수정한다. 총 5개의 `.ins-section`이 있다.

- 첫 번째(`속성`, line 1531 부근) → 클래스를 `ins-section collapsed`로
- 두 번째(`실시간 지표`, line 1542 부근) → 그대로 `ins-section`
- 세 번째(`담당 · 온콜`, line 1551 부근) → 그대로
- 네 번째(`분류 및 의존`, line 1559 부근) → 클래스를 `ins-section collapsed`로
- 다섯 번째(`활동 기록`, line 1572 부근) → 그대로

HTML 편집 예:
```html
      <div class="ins-section collapsed">
        <h3><span class="kr">속성</span> <a href="#">구성 편집</a></h3>
        ...
```

```html
      <div class="ins-section collapsed">
        <h3><span class="kr">분류 및 의존</span></h3>
        ...
```

- [ ] **Step 3: 브라우저 검증 — 390px**

현재 인스펙터는 여전히 화면 밖에 있다 (드로어 open 로직 없음). DevTools Elements에서 `<aside class="inspector" id="inspector">`에 임시로 `class="inspector open"`을 수동 추가해 드로어를 연다.
- 열렸을 때 오른쪽에서 슬라이드 인 된다
- 최상단: 인스펙터 헤더(닫기 ×, 서비스명, 낙관)
- 그 다음 sticky: `[점검 모드] [로그] [재시작]` 3버튼이 가로 균등
- 그 다음 섹션 순서: `실시간 지표` → `담당·온콜` → `활동 기록` → `속성`(접힘) → `분류 및 의존`(접힘)
- 접힘 섹션의 h3 좌측에 `▶`, 펼침은 `▼`
- 타임라인에서 시간이 줄바꿈 되어 작은 글씨로 표시

수동 추가한 class를 제거한다 (검증용이었음).

- [ ] **Step 4: 브라우저 검증 — 1440px**

데스크탑에서는 인스펙터가 기존대로 우측 grid 칸에 상시 노출. `.ins-actions`는 하단, 섹션은 DOM 순서대로. 회귀 없음 확인.

- [ ] **Step 5: 체크포인트**

---

### Task 9: 모바일 상태바 (≤767) — 축약 고정 하단

**Files:**
- Modify: `dashboard5.html` — Tier 3 `@media` 블록 추가, `<div class="statusbar">` 내부 수정

- [ ] **Step 1: 상태바 내부 `.s-item`에 시맨틱 클래스 부여**

line 1604 `<div class="statusbar">` 블록을 다음으로 교체한다.

```html
  <!-- ============ STATUS BAR ============ -->
  <div class="statusbar">
    <div class="s-left">
      <span class="s-item sb-keep"><span class="led"></span><span class="kr">연결됨</span></span>
      <span class="s-item"><strong>브랜치</strong> main</span>
      <span class="s-item sb-keep"><strong><span class="kr">동기화</span></strong> <span class="kr">12초 전</span></span>
    </div>
    <div class="s-mid">
      <span class="s-item"><span class="kr">MS-2026-042 · 14,280 단어 · 47페이지 · 한/영</span></span>
    </div>
    <div class="s-right">
      <span class="s-item"><span class="led v"></span><span class="kr">알림 3건</span></span>
      <span class="s-item"><strong>줄</strong> 214:32</span>
      <span class="s-item">UTF-8</span>
      <span class="s-item sb-keep">v 4.2.1</span>
    </div>
  </div>
```

- [ ] **Step 2: Tier 3 블록에 상태바 규칙 추가**

```css
    .statusbar {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 25;
      height: 24px;
      padding: 0 var(--space-3);
      font-size: var(--text-xs);
    }
    .statusbar .s-mid { display: none; }
    .statusbar .s-item:not(.sb-keep) { display: none; }
    .statusbar .s-left,
    .statusbar .s-right { gap: var(--space-3); }
    /* 콘텐츠 영역 padding 보정 */
    .content { padding-bottom: 28px; }
```

- [ ] **Step 3: 브라우저 검증 — 390px**

- 하단 고정 상태바가 24px 높이로 보임
- 좌측: `● 연결됨`, `동기화 12초 전` / 우측: `v 4.2.1`
- 브랜치·문서·줄·UTF-8·알림 배지 등은 모두 숨김
- 콘텐츠 스크롤 시 상태바에 가려지지 않고 하단 여백 확보

- [ ] **Step 4: 브라우저 검증 — 1440px**

데스크탑 상태바는 그대로 전체 정보 표시. 회귀 없음.

- [ ] **Step 5: 체크포인트**

---

### Task 10: 드로어 토글 JS — 햄버거 · 인스펙터 버튼 · 닫기 · 스크림 · ESC

**Files:**
- Modify: `dashboard5.html` — `<script>` 블록 (line 1623)

- [ ] **Step 1: 기존 `<script>` 마지막 줄(line 1694 `}` 닫힘) 뒤에 아래 JS 모듈을 추가**

`<script>` 블록의 `});` 다음, `</script>` 직전에 붙여넣는다.

```javascript
  // ================================================================
  // Drawer system (mobile sidebar + inspector drawers)
  // ================================================================
  (function initDrawers() {
    const sidebar = document.getElementById('sidebar');
    const inspector = document.getElementById('inspector');
    const scrim = document.querySelector('[data-drawer-scrim]');
    const hamburger = document.querySelector('.btn-hamburger');
    const inspectorBtnMobile = document.querySelector('.btn-inspector-mobile');
    const inspectorBtnTablet = document.querySelector('.btn-inspector-toggle');
    const closeButtons = document.querySelectorAll('[data-close]');

    const drawers = {
      sidebar: {
        el: sidebar,
        triggers: [hamburger],
      },
      inspector: {
        el: inspector,
        triggers: [inspectorBtnMobile, inspectorBtnTablet],
      },
    };

    let lastTriggerByDrawer = {};

    function openDrawer(name, trigger) {
      const d = drawers[name];
      if (!d || !d.el) return;
      d.el.classList.add('open');
      scrim.classList.add('open');
      document.body.dataset.prevOverflow = document.body.style.overflow || '';
      document.body.style.overflow = 'hidden';
      d.triggers.forEach(t => t && t.setAttribute('aria-expanded', 'true'));
      lastTriggerByDrawer[name] = trigger || d.triggers[0];
    }

    function closeDrawer(name) {
      const d = drawers[name];
      if (!d || !d.el) return;
      d.el.classList.remove('open');
      d.triggers.forEach(t => t && t.setAttribute('aria-expanded', 'false'));
      // 모두 닫혔을 때만 스크림·스크롤락 해제
      if (!sidebar.classList.contains('open') && !inspector.classList.contains('open')) {
        scrim.classList.remove('open');
        document.body.style.overflow = document.body.dataset.prevOverflow || '';
        delete document.body.dataset.prevOverflow;
      }
      const trig = lastTriggerByDrawer[name];
      if (trig && typeof trig.focus === 'function') trig.focus();
      delete lastTriggerByDrawer[name];
    }

    function closeAll() {
      Object.keys(drawers).forEach(closeDrawer);
    }

    if (hamburger) {
      hamburger.addEventListener('click', () => {
        if (sidebar.classList.contains('open')) closeDrawer('sidebar');
        else openDrawer('sidebar', hamburger);
      });
    }

    [inspectorBtnMobile, inspectorBtnTablet].forEach(btn => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        if (inspector.classList.contains('open')) closeDrawer('inspector');
        else openDrawer('inspector', btn);
      });
    });

    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        closeDrawer(btn.dataset.close);
      });
    });

    if (scrim) {
      scrim.addEventListener('click', closeAll);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll();
    });

    // viewport 상승 시 드로어 자동 해제 (예: 회전으로 1024px 넘어감)
    const mq = window.matchMedia('(min-width: 1024px)');
    mq.addEventListener('change', (ev) => {
      if (ev.matches) {
        sidebar.classList.remove('open');
        scrim.classList.remove('open');
      }
    });

    // 외부 사용을 위한 노출
    window.__drawers = { open: openDrawer, close: closeDrawer, closeAll };
  })();
```

- [ ] **Step 2: 브라우저 검증 — 390px · 햄버거**

햄버거 버튼 클릭 → 사이드바가 왼쪽에서 슬라이드 인, 스크림이 검게 깔림. 사이드바 상단 × 클릭 → 닫힘. 햄버거 → 열림 → 스크림 클릭 → 닫힘. ESC 키 → 닫힘.

- [ ] **Step 3: 브라우저 검증 — 390px · 인스펙터**

상단 앱바 `[상세 ▸]` 버튼은 **비활성** 상태여야 함 (`disabled` 속성). 현재는 서비스 선택 연동이 없으므로 Task 11에서 활성화. 지금은 DevTools에서 수동으로 `disabled` 속성을 제거하고 테스트한다:
- 클릭 → 오른쪽에서 인스펙터 슬라이드 인
- × 닫기 → 닫힘
- 스크림 · ESC 동일 동작

- [ ] **Step 4: 브라우저 검증 — 820px (태블릿)**

툴바 내 `[상세 ▸]` 버튼은 활성화되지 않음 (Task 11에서 해결). 수동으로 disabled 제거 후:
- 클릭 → 인스펙터가 오른쪽에서 슬라이드 인
- 사이드바는 grid 안 그대로
- 스크림 · ESC 동작

- [ ] **Step 5: 체크포인트**

---

### Task 11: 서비스 행 탭 → 인스펙터 자동 열기 + 토글 버튼 활성화

**Files:**
- Modify: `dashboard5.html` — `<script>` 블록

- [ ] **Step 1: 기존 "Doc row selection" 블록(line 1663–1669) 확장**

기존:
```javascript
  // Doc row selection
  document.querySelectorAll('.doc-row').forEach(row => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.doc-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
    });
  });
```

다음으로 교체:
```javascript
  // Doc row selection → enable inspector toggle buttons + auto-open on mobile
  const inspectorTriggers = [
    document.querySelector('.btn-inspector-mobile'),
    document.querySelector('.btn-inspector-toggle'),
  ].filter(Boolean);
  const mqMobile = window.matchMedia('(max-width: 767px)');
  const mqTabletOrMobile = window.matchMedia('(max-width: 1023px)');

  document.querySelectorAll('.doc-row').forEach(row => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.doc-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');

      // 서비스가 선택되면 인스펙터 토글 버튼 활성화
      inspectorTriggers.forEach(btn => { btn.disabled = false; });

      // 모바일(≤767)에서는 자동으로 인스펙터 드로어 열기
      if (mqMobile.matches && window.__drawers) {
        window.__drawers.open('inspector', inspectorTriggers[0]);
      }
    });
  });
```

- [ ] **Step 2: 초기 상태에서 "결제 게이트웨이" 행이 `selected`로 시작되므로 토글 버튼 초기 활성화**

기존 `<script>` 상단(`const menubar = ...` 바로 앞)에 다음을 추가:

```javascript
  // 초기 선택된 행이 있으면 인스펙터 토글 버튼을 미리 활성화
  const preSelected = document.querySelector('.doc-row.selected');
  if (preSelected) {
    document.querySelectorAll('.btn-inspector-mobile, .btn-inspector-toggle')
      .forEach(btn => { btn.disabled = false; });
  }
```

- [ ] **Step 3: 브라우저 검증 — 390px**

- 페이지 로드 시 `결제 게이트웨이`가 `selected` 상태, 앱바의 `[상세 ▸]` 버튼 활성화 (클릭 가능)
- 다른 서비스(예: `회원 서비스`) 탭 → 해당 행 `selected`, 동시에 인스펙터 드로어가 자동으로 오른쪽에서 슬라이드 인
- × 또는 스크림으로 닫으면 다시 목록으로 복귀

참고: 현재는 인스펙터 내용이 "결제 게이트웨이" 그대로 표시된다 (정적 HTML). 데이터 연동은 범위 외.

- [ ] **Step 4: 브라우저 검증 — 820px**

툴바의 `[상세 ▸]` 활성화, 클릭으로 인스펙터 열림/닫힘. 행 탭 시 자동 열기는 **일어나지 않음** (태블릿에선 수동 트리거 유지). 이게 설계 의도.

- [ ] **Step 5: 브라우저 검증 — 1440px**

데스크탑은 인스펙터가 항상 grid 안에 있으므로 토글 버튼 무관. 행 탭 → selected 변경만. 회귀 없음.

- [ ] **Step 6: 체크포인트**

---

### Task 12: 포커스 트랩 + 외부 요소 비활성화

**Files:**
- Modify: `dashboard5.html` — `<script>` 드로어 모듈 내부 (Task 10에서 추가한 `initDrawers`)

- [ ] **Step 1: `initDrawers` 내부 `openDrawer` / `closeDrawer` 수정**

Task 10에서 추가한 `initDrawers` IIFE 내부의 기존 `openDrawer` 함수를 아래로 교체한다.

```javascript
    function trapFocus(container, event) {
      const focusables = container.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    }

    function openDrawer(name, trigger) {
      const d = drawers[name];
      if (!d || !d.el) return;
      d.el.classList.add('open');
      d.el.setAttribute('role', 'dialog');
      d.el.setAttribute('aria-modal', 'true');
      scrim.classList.add('open');
      document.body.dataset.prevOverflow = document.body.style.overflow || '';
      document.body.style.overflow = 'hidden';
      d.triggers.forEach(t => t && t.setAttribute('aria-expanded', 'true'));
      lastTriggerByDrawer[name] = trigger || d.triggers[0];

      // 드로어 내부 첫 focusable로 포커스 이동
      const firstFocusable = d.el.querySelector(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) setTimeout(() => firstFocusable.focus(), 60);
    }
```

- [ ] **Step 2: 기존 `keydown` 핸들러를 다음으로 교체 (ESC + Tab trap)**

```javascript
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAll();
        return;
      }
      if (e.key === 'Tab') {
        const openDrawer = [sidebar, inspector].find(el => el && el.classList.contains('open'));
        if (openDrawer) trapFocus(openDrawer, e);
      }
    });
```

- [ ] **Step 3: `closeDrawer`에서 `role`/`aria-modal` 정리**

Task 10의 `closeDrawer` 함수에서 `d.el.classList.remove('open');` 다음 라인에 추가:

```javascript
      d.el.removeAttribute('role');
      d.el.removeAttribute('aria-modal');
```

- [ ] **Step 4: 브라우저 검증 — 390px**

- 햄버거 클릭 → 사이드바 열림 → 포커스가 사이드바 내부 첫 버튼(`×`)으로 이동
- Tab 반복 → 사이드바 내부 요소만 순환
- Shift+Tab → 역방향 순환
- ESC → 닫힘, 포커스가 햄버거 버튼으로 복귀
- 인스펙터도 동일 동작

- [ ] **Step 5: 체크포인트**

---

### Task 13: 스와이프로 드로어 닫기 (PointerEvents)

**Files:**
- Modify: `dashboard5.html` — `<script>` 드로어 모듈 내부

- [ ] **Step 1: `initDrawers` IIFE 내부, `window.__drawers = ...` 이전에 스와이프 로직 추가**

```javascript
    // ---- 스와이프로 닫기 ----
    function attachSwipe(el, direction) {
      // direction: -1 = 왼쪽으로 닫기(사이드바), +1 = 오른쪽으로 닫기(인스펙터)
      let startX = null;
      let currentDelta = 0;
      let active = false;
      const width = () => el.getBoundingClientRect().width;

      el.addEventListener('pointerdown', (e) => {
        if (!el.classList.contains('open')) return;
        if (e.pointerType !== 'touch') return;
        startX = e.clientX;
        currentDelta = 0;
        active = true;
        el.style.transition = 'none';
      });

      el.addEventListener('pointermove', (e) => {
        if (!active || startX === null) return;
        const delta = e.clientX - startX;
        const bounded = direction === -1 ? Math.min(0, delta) : Math.max(0, delta);
        currentDelta = bounded;
        el.style.transform = `translateX(${bounded}px)`;
      });

      function end() {
        if (!active) return;
        active = false;
        el.style.transition = '';
        el.style.transform = '';
        if (Math.abs(currentDelta) > width() * 0.5) {
          const name = el.id; // 'sidebar' or 'inspector'
          closeDrawer(name);
        }
        startX = null;
        currentDelta = 0;
      }

      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('pointerleave', end);
    }

    attachSwipe(sidebar, -1);
    attachSwipe(inspector, +1);
```

- [ ] **Step 2: 브라우저 검증 — 390px (DevTools Device Toolbar, touch 에뮬레이션 활성화)**

- 햄버거 → 사이드바 열림
- 사이드바를 왼쪽으로 드래그 → 손가락 따라 이동
- 드로어 폭 50% 이상 드래그 후 놓음 → 닫힘
- 50% 미만 → snap-back (원위치)
- 인스펙터 → 오른쪽으로 드래그 → 동일 동작

Touch 에뮬레이션: DevTools → Device Toolbar → 기기 프리셋 선택 시 자동, 또는 More tools → Sensors → Touch: `Force enabled`.

- [ ] **Step 3: 브라우저 검증 — 1440px**

데스크탑은 터치가 아니므로 영향 없음. 드래그로 사이드바/인스펙터가 움직이지 않아야 함(드로어 아님 + touch 조건).

- [ ] **Step 4: 체크포인트**

---

### Task 14: 인스펙터 아코디언 토글 JS

**Files:**
- Modify: `dashboard5.html` — `<script>` 블록 하단

- [ ] **Step 1: `initDrawers` IIFE 뒤, `</script>` 이전에 추가**

```javascript
  // ================================================================
  // Inspector accordion (mobile only)
  // ================================================================
  (function initAccordion() {
    const mq = window.matchMedia('(max-width: 767px)');
    document.querySelectorAll('.inspector .ins-section h3').forEach(h3 => {
      h3.setAttribute('tabindex', '0');
      h3.setAttribute('role', 'button');
      h3.addEventListener('click', (e) => {
        // 구성 편집 같은 링크 클릭은 아코디언 토글 제외
        if (e.target.tagName === 'A') return;
        if (!mq.matches) return;
        h3.parentElement.classList.toggle('collapsed');
      });
      h3.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && mq.matches) {
          e.preventDefault();
          h3.parentElement.classList.toggle('collapsed');
        }
      });
    });
  })();
```

- [ ] **Step 2: 브라우저 검증 — 390px**

- 서비스 행 탭 → 인스펙터 드로어 자동 열림
- `속성` 섹션 h3 클릭 → 펼쳐짐 (▼로 변경)
- `실시간 지표` h3 클릭 → 접힘 (▶로 변경)
- Tab으로 h3에 포커스 후 Enter/Space → 토글

- [ ] **Step 3: 브라우저 검증 — 1440px**

데스크탑에서 h3 클릭해도 아코디언 동작 안 함 (mq 조건). 섹션은 항상 펼침. 회귀 없음.

- [ ] **Step 4: 체크포인트**

---

### Task 15: 최종 크로스 뷰포트 검증

**Files:**
- 편집 없음 — 순수 검증 태스크

- [ ] **Step 1: 1440 × 900 (데스크탑 풀) 검증**

다음 체크리스트 통과:
- [ ] 타이틀바 macOS 창 컨트롤 표시
- [ ] 메뉴바 10여 항목 한 줄 전개
- [ ] 3단 레이아웃: 사이드바 240 / 콘텐츠 / 인스펙터 300
- [ ] 서비스 목록 6열 테이블
- [ ] 인스펙터 섹션 5개 모두 상시 펼침, 액션바 하단
- [ ] 상태바 하단 전체 정보 표시
- [ ] 앱바 `display: none`
- [ ] 메뉴 드롭다운 클릭 시 열림

- [ ] **Step 2: 1280 × 800 검증**

1440px과 동일해야 함.

- [ ] **Step 3: 1024 × 768 검증**

- [ ] Tier 1 적용: 사이드바 200 / 인스펙터 260
- [ ] "최근 이벤트" 열 숨김
- [ ] 나머지 데스크탑과 동일

- [ ] **Step 4: 820 × 1180 (iPad portrait) 검증**

- [ ] Tier 2 적용: 사이드바 200 + 콘텐츠 2단
- [ ] 인스펙터는 오른쪽 밖으로 밀림
- [ ] 툴바 좌측에 `[상세 ▸]` 버튼 (초기 활성)
- [ ] `[상세 ▸]` 클릭 → 인스펙터 드로어 열림, 스크림 표시
- [ ] 스크림/× /ESC로 닫힘
- [ ] 타이틀바 · 메뉴바 · 앱바 · 상태바 전체 노출(타블릿에선 앱바 숨김, 메뉴바 노출)

- [ ] **Step 5: 414 × 896, 390 × 844, 360 × 740 검증**

각 폭에서:
- [ ] 타이틀바 · 메뉴바 숨김
- [ ] 앱바 48px 표시: `☰ 운영실 · OPSROOM ✉³ ● 상세 ▸`
- [ ] 360px에선 앱바 타이틀 "jp" 장식 숨김
- [ ] 탭 바 가로 스크롤
- [ ] 서비스 목록 2줄 리스트 + 좌측 세로 띠(장애·주의)
- [ ] 행 탭 → 인스펙터 자동 열림
- [ ] 햄버거 → 사이드바 드로어
- [ ] 스크림 · × · ESC · 스와이프(touch) 모두 동작
- [ ] 인스펙터 아코디언 동작
- [ ] 상태바 하단 고정, 3개 항목만

- [ ] **Step 6: `prefers-reduced-motion` 검증**

DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`. 햄버거 클릭 시 드로어 트랜지션이 120ms로 짧아지는지 확인.

- [ ] **Step 7: 키보드 전용 조작 검증 (390px)**

- Tab으로 앱바 → 햄버거에 포커스
- Enter → 드로어 열림, 포커스 이동
- Tab으로 사이드바 내부 순환만
- Shift+Tab 역방향
- ESC → 닫힘 + 햄버거로 포커스 복귀

- [ ] **Step 8: 최종 체크포인트**

모든 뷰포트·인터랙션 체크리스트 통과. `dashboard5.html` 저장.

---

## 완료 기준

다음 조건이 모두 충족되면 완료:

1. 1024px 이상에서 기존 데스크탑 시각 · 인터랙션이 **회귀 없음**
2. 768–1023px에서 인스펙터가 우측 드로어로 동작
3. 480–767px에서 사이드바 · 인스펙터가 양쪽 드로어로 동작, 앱바 노출
4. 360px에서 레이아웃 · 터치 인터랙션 정상
5. 드로어 열림 시: 스크림 · ESC · × 버튼 · 스와이프로 닫힘 가능
6. 포커스 트랩 · 스크롤 락 · 닫힘 시 포커스 복귀
7. `prefers-reduced-motion` 환경에서 트랜지션 단축
8. 종이 질감 · 낙관 배지 · 영문 보조 라벨 · Pretendard 타이포 정체성 **모바일에서도 유지**

## 비포함 (YAGNI)

- 다크 모드
- 실시간 데이터 바인딩
- 토폴로지 / 카드 뷰
- 다른 dashboard 파일(4, 6~9) 적용 (같은 토큰·패턴 재사용 가능하지만 이번 작업 대상 아님)
- 서비스 워커, PWA, 오프라인 지원
