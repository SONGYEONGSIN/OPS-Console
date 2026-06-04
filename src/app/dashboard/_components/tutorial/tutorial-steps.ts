// 첫 방문 가이드 투어 — 영역별 스포트라이트 스텝 (driver.js).
// element 가 있으면 해당 영역을 하이라이트, 없으면 화면 중앙 안내.
// 스텝을 크게 바꾸면 KEY의 버전(v1)을 올려 기존 사용자에게도 재노출한다.

export type TutorialStep = {
  /** 하이라이트할 대상의 CSS 선택자. 없으면 중앙 안내(환영/마무리). */
  element?: string;
  title: string;
  description: string;
  /** 이 스텝 진입 시 이동할 메뉴 slug. 메뉴 개요 스텝에만 설정. */
  navigateTo?: string;
};

/** localStorage 열람 플래그 키. 스텝 개편 시 버전 증가로 재노출. */
export const TUTORIAL_SEEN_KEY = "ops-console:tutorial-seen:v2";

/** 전역 인트로 스텝 — 첫 방문 시 앱 전체 영역 오리엔테이션. 메뉴별 상세 스텝과 구분. */
export const INTRO_STEPS: TutorialStep[] = [
  {
    title: "운영부 상황실에 오신 것을 환영합니다",
    description:
      "사내 운영 업무를 한곳에서 관리하는 콘솔입니다. 주요 영역을 차례로 짚어드릴게요.",
  },
  {
    element: "#sidebar",
    title: "왼쪽 사이드바 — 메뉴",
    description:
      "운영·작업·분석 업무가 카테고리로 묶여 있습니다. 항목을 클릭하면 가운데에 해당 목록이 열립니다.",
  },
  {
    element: "[data-tutorial='topbar']",
    title: "상단 — 검색 · 탭",
    description:
      "자주 쓰는 메뉴를 탭으로 띄워두고, 가운데 검색으로 원하는 항목을 빠르게 찾을 수 있습니다.",
  },
  {
    element: "[data-tutorial='content']",
    title: "목록 + 인스펙터",
    description:
      "이 영역의 목록에서 항목을 선택하면 오른쪽 인스펙터에서 상세를 확인하고 바로 편집할 수 있습니다.",
  },
  {
    title: "이제 시작해볼까요",
    description: "주요 영역은 여기까지입니다. 직접 둘러보며 사용해 보세요.",
  },
];

/** 투어 열람 여부 (localStorage 비활성 시 '열람함'으로 간주해 노출 안 함). */
export function hasTutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_SEEN_KEY) != null;
  } catch {
    return true;
  }
}

/** 투어 열람 처리. */
export function markTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
  } catch {
    // localStorage 비활성(시크릿 등) — 무시
  }
}
