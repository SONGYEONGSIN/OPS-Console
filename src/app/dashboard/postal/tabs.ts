import type { PageTab } from "@/components/common/PageTabs";

/**
 * 우편물 탭.
 *
 * 페이지 제목이 이미 '우편물' 이라 첫 탭까지 '우편물' 이면 '우편물 > 우편물' 로
 * 겹쳐 읽힌다. 안에 무엇이 있는지를 말하도록 '등기관리' 로 둔다.
 *
 * page.tsx 가 아니라 여기 있는 이유: 서버 컴포넌트 파일은 테스트에서 불러오기
 * 어려운데, 탭은 화면의 길 안내라 고정해 둘 값이다.
 */
export const POSTAL_TABS: readonly PageTab[] = [
  { key: "receipts", label: "등기관리", href: "/dashboard/postal?tab=receipts" },
  { key: "petty", label: "전도금", href: "/dashboard/postal?tab=petty" },
];
