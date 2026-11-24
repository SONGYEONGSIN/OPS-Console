import { renderOpsWeekly } from "../ops-weekly/_screen";

/**
 * 주간업무보고(신규) — 관리자 전용. 기존 메뉴와 같은 데이터·본문에 머리(제목·[이번 주][다음 주])와
 * KPI 카드 8장만 새 판이다. 다듬는 동안 기존 메뉴 옆에 둔다.
 */
export default async function OpsWeeklyV2Page({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; tab?: string; op?: string }>;
}) {
  return renderOpsWeekly("v2", searchParams);
}
