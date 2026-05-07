# Design — OPS Console Rebrand

- **Date**: 2026-05-08
- **Owner**: 송영석
- **Topic**: chrome bar 명칭/로고 재설계 (PIVOT → OPS Console)
- **Source**: 사용자 직접 피드백 (brainstorm 4안 중 A 선택)
- **Status**: Awaiting user review
- **Predecessor**: `docs/superpowers/specs/2026-05-04-dashboard-chrome-redesign-design.md` (PIVOT chrome 1차)

## 1. Goal

기존 PIVOT 모더니즘 정체성을 **OPS Console**(직설적 운영 콘솔 명칭) + 터미널 프롬프트 `>_` 로고로 교체. chrome 전체 톤(흑백 + vermilion 액센트)은 유지하고, 좌측 brand 영역만 갱신. 모더니즘 추상 사각보다 운영자 친숙한 명령행 메타포로 본질을 명시.

## 2. Out of Scope

- chrome 그 외 영역(검색·SessionTimer·AlertsBell·ChromeUser) — 유지
- 콘텐츠 본체 톤(cream 배경 등) — 유지
- 콘텐츠 페이지 헤더 패턴(breadcrumb+tabs+meta+headline) — 별도 epic
- 콘텐츠 클릭 → 인스펙터 슬라이드인 — 별도 epic

## 3. Architecture

### 3.1 Identity (확정)

- **명칭**: `OPS Console`
- **부제**: 제거 (기존 `OPS DESK` 부제 삭제 — `OPS`가 본명에 포함됨)
- **로고**: 26×22 검은 사각 + 안쪽 흰 `>_` 모노스페이스 (IBM Plex Mono / Menlo)
- **타이포**: Pretendard 16px font-weight 800, letter-spacing -0.01em
- **색상**: 기존 chrome-graphite/snow 토큰 재활용 (신규 토큰 0개)

### 3.2 ChromeBrand 변경

**Before**:
```tsx
<span className="grid h-[18px] w-[18px] place-items-center bg-chrome-graphite">
  <span className="block h-2 w-2 bg-chrome-snow" />
</span>
<span className="text-base font-extrabold tracking-tight text-chrome-graphite">PIVOT</span>
<span className="text-2xs font-bold uppercase tracking-[0.32em] text-chrome-muted">OPS DESK</span>
```

**After**:
```tsx
<span
  aria-hidden
  className="inline-flex h-[22px] w-[26px] items-center justify-center bg-chrome-graphite font-mono text-[13px] font-bold leading-none text-chrome-snow tracking-[-0.05em]"
>
  &gt;_
</span>
<span className="text-base font-extrabold tracking-tight text-chrome-graphite">OPS Console</span>
```

부제 span 제거. 로고 사이즈 18×18 → 26×22 (모노스페이스 `>_`을 담기 위함).

### 3.3 모바일 AppBar 변경

`src/app/dashboard/layout.tsx` AppBar 텍스트:
- Before: `PIVOT <em>·</em> OPS DESK`
- After: `OPS Console`

### 3.4 테스트 갱신

- `Chrome.test.tsx` — `PIVOT`/`OPS DESK` 어설션 → `OPS Console` 단일 어설션 + `>_` 텍스트 확인
- `e2e/dashboard.spec.ts` — `PIVOT`/`OPS DESK` 어설션 → `OPS Console` 단일 어설션
- `__tests__/DashboardShell.test.tsx`, `__tests__/ChromeRight.test.tsx` 등 — PIVOT 텍스트 직접 어설션 없음 (mock으로 대체) 확인 후 변경 불필요

## 4. 영향 파일

### Modify
- `src/app/dashboard/_components/chrome/ChromeBrand.tsx` — 로고 + 워드마크 교체
- `src/app/dashboard/layout.tsx` — AppBar 텍스트
- `src/app/dashboard/_components/chrome/__tests__/Chrome.test.tsx` — 어설션 갱신
- `e2e/dashboard.spec.ts` — 어설션 갱신

**HARD-GATE 등급**: 인라인 설계 (4 파일).

## 5. 데이터 흐름

기존과 동일. ChromeBrand는 server component, props 없음, 단순 render.

## 6. 에러 처리

해당 없음 (시각 변경만).

## 7. 테스트 전략

### 단위 (vitest, TDD RED→GREEN)
1. `Chrome.test.tsx` 어설션을 `OPS Console` + `>_`로 변경 — RED
2. `ChromeBrand.tsx` 텍스트/로고 교체 — GREEN
3. AppBar 텍스트 갱신 (스타일 전용, TDD 예외)

### e2e
- `dashboard.spec.ts`의 chrome desktop 테스트 어설션 갱신:
  - `expect(page.getByText("PIVOT", { exact: true }).first()).toBeVisible()` → `expect(page.getByText("OPS Console", { exact: true }).first()).toBeVisible()`
  - `OPS DESK` 어설션 제거

## 8. 리스크

- **PIVOT 텍스트가 다른 곳에 잔존**: 검색으로 전수 확인 (e2e 포함). 잔존하면 모두 갱신.
- **로고 사이즈 변경**: 18×18 → 26×22로 가로 폭 증가. 좌측 zone 1fr 그리드 안에서 자동 조정되지만 시각 확인 필수.
- **`>_` 모노스페이스 폰트**: 시스템 모노가 적용되는지 확인 필요. font-mono Tailwind utility가 v4에서 정상 작동하는지 (대부분 OK).

## 9. 검증 (DoD)

1. `grep -r "PIVOT" src/ e2e/ docs/superpowers/specs/` — 잔존 0건 (이전 spec 참조 제외)
2. `npm run lint` 0 errors
3. `npx tsc --noEmit` 0 errors
4. `npm test` 244+ tests pass
5. `npm run e2e` 갱신된 어설션 통과
6. dev 서버 `/dashboard` — 좌측 brand가 `[>_] OPS Console` 형태로 보임
7. design-audit hook — 0 위반
