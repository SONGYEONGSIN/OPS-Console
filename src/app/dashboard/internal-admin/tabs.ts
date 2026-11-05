import type { PageTab } from "@/components/common/PageTabs";

/**
 * 내부관리자 탭 — 메인 한 줄 + 서브 한 줄.
 *
 * 메인 탭은 내부관리자 업무 하나(SMS 발신번호 등록)다. 앞으로 업무가 늘면 여기에
 * 한 줄씩 붙는 자리라 하나뿐이어도 보인다. 서브 탭은 그 업무 안의 뷰다.
 *
 * page.tsx 가 아니라 여기 있는 이유: 서버 컴포넌트 파일은 테스트에서 불러오기
 * 어려운데, 탭은 화면의 길 안내라 고정해 둘 값이다.
 */
const BASE = "/dashboard/internal-admin";

export const MAIN_TABS = [
  { key: "sms", label: "SMS 발신번호 등록", href: `${BASE}?tab=sms` },
] as const satisfies readonly PageTab[];

/** 개요(견본)는 지웠다 — SMS 자료와 무관한 가짜 데이터였다. 옛 주소는 기본 뷰로 간다. */
export const SUB_VIEWS = [
  { key: "schools", label: "학교", href: `${BASE}?tab=sms&view=schools` },
  { key: "numbers", label: "발신번호", href: `${BASE}?tab=sms&view=numbers` },
  { key: "checks", label: "확인 필요", href: `${BASE}?tab=sms&view=checks` },
] as const satisfies readonly PageTab[];

export type MainTab = (typeof MAIN_TABS)[number]["key"];
export type View = (typeof SUB_VIEWS)[number]["key"];

/** 찾아보는 일의 시작이 학교라 학교가 기본이다. */
export const DEFAULT_VIEW: View = "schools";

/** 화면 안 링크용 — 쿼리는 호출한 쪽이 `&q=…` 식으로 덧붙인다. */
export function viewHref(view: View): string {
  return SUB_VIEWS.find((v) => v.key === view)!.href;
}

function findView(raw: string): View | null {
  const hit = SUB_VIEWS.find((v) => v.key === raw);
  return hit ? hit.key : null;
}

/**
 * `?tab=` · `?view=` 를 서브 뷰 하나로 푼다.
 *
 * - 새 형식: `tab=sms&view=<뷰>` — 모르는 view 는 기본 뷰.
 * - 옛 형식: `tab=<뷰>` (탭이 하나이던 때의 주소). 북마크와 이미 보낸 링크가 있어
 *   같은 뷰로 푼다. 이때 `view` 는 보지 않는다.
 * - 모르는 tab 은 기본 뷰.
 *
 * 뷰 이름을 여기서 다시 적지 않고 `SUB_VIEWS` 에서 찾는다. 두 벌이 되면 탭은 보이는데
 * 눌러도 기본 뷰가 열린다.
 */
export function resolveView(tab: string, view: string): View {
  if (MAIN_TABS.some((t) => t.key === tab)) {
    return findView(view) ?? DEFAULT_VIEW;
  }
  return findView(tab) ?? DEFAULT_VIEW;
}
