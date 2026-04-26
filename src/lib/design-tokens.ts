/**
 * Folio (OPSROOM) Design Tokens
 *
 * 명세: design-ref/folio-login.html, design-ref/folio-dashboard.html
 *
 * 핵심 원칙:
 * - washi(종이) 베이스 + 낙관(vermilion) 액센트의 에디토리얼 톤 유지
 * - 본문은 Pretendard Variable, 숫자/ID/타임스탬프는 tabular-nums 자동 정렬
 * - 모바일(≤767px)에서 본문 타이포 1px 상향, tap-min 36→44px, 모션 220→120ms
 * - 컴포넌트에서 hex/rgb 하드코딩 금지 — Tailwind 클래스 또는 본 토큰 사용
 */

export const colors = {
  // Paper / surface
  washi: '#ede6d2',
  washiRaised: '#f4eddd',
  cream: '#faf4e6',
  sidebar: '#e5dec8',
  sidebarHover: '#dcd4bc',
  // Ink (text)
  ink: '#15120c',
  inkSoft: '#3d3529',
  muted: '#716855',
  faint: '#a8a08a',
  // Line / border
  line: '#15120c',
  lineSoft: 'rgba(21, 18, 12, 0.12)',
  // Accent — vermilion(낙관) 주, 보조는 indigo/gold/sage
  vermilion: '#b8331e',
  vermilionDeep: '#8e2412',
  indigo: '#1f3a5f',
  gold: '#9c7a2c',
  sage: '#556b2f',
} as const;

/** 본문/숫자 모두 Pretendard. 데이터 표 등 정렬이 필요한 셀에는 tabular-nums 클래스. */
export const fontFamily = {
  sans: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
} as const;

/**
 * 데스크탑 기준. 모바일(≤767px)에서 md/xl/2xl/3xl이 1~8px 상향됨 (globals.css 미디어쿼리).
 * 3xs/2xs는 statusbar / 타임라인 / 메타 라벨 등 미세 UI 라벨용 — 토큰 스케일 시작점(xs=11)보다 작은 의도적 보조 크기.
 */
export const fontSize = {
  '3xs': '9px',
  '2xs': '10px',
  xs: '11px',
  sm: '12px',
  md: '13px',
  lg: '15px',
  xl: '20px',
  '2xl': '26px',
  '3xl': '40px',
} as const;

export const fontSizeMobile = {
  md: '14px',
  xl: '18px',
  '2xl': '22px',
  '3xl': '32px',
} as const;

/** 4px base. Tailwind spacing 키와 동일 인덱스. */
export const spacing = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '28px',
  7: '40px',
  8: '56px',
} as const;

/** WCAG 모바일 타깃 44px, 데스크탑 36px. */
export const tap = {
  desktop: '36px',
  mobile: '44px',
} as const;

/** 드로어/모달 모션. reduced-motion 시 120ms. */
export const motion = {
  drawerEase: 'cubic-bezier(0.2, 0.0, 0.2, 1)',
  drawerMs: '250ms',
  drawerMsMobile: '220ms',
  drawerMsReduced: '120ms',
} as const;

/**
 * 토큰화된 box-shadow — 반복 사용처에서 인라인 style 제거용.
 * - led-*: 상태 인디케이터 미세 발광 (statusbar / 모바일 appbar / inspector seal)
 * - drawer-*: 모바일 드로어 펼침 시 측면 음영
 */
export const shadows = {
  ledSage: '0 0 4px var(--sage)',
  ledSageStrong: '0 0 6px var(--sage)',
  ledVermilion: '0 0 4px var(--vermilion)',
  drawerLeft: '8px 0 24px rgba(21, 18, 12, 0.08)',
  drawerRight: '-8px 0 24px rgba(21, 18, 12, 0.08)',
} as const;

/** 데이터 표 / 식별자 / 타임스탬프 정렬용. globals.css에서 .tabular 클래스로도 노출. */
export const numericClass = 'tabular-nums';
