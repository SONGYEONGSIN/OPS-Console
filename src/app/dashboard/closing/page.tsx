import { ClosingScreen } from "./_ClosingScreen";

/**
 * 서비스마감 — **마감이 지난** 서비스.
 *
 * 진행 중인 것은 배포·운영 메뉴가 맡는다. 전에는 한 화면에 섞어 두고 `진행중` 칩으로
 * 갈랐는데, 두 일이 성격이 달라(운영 대상 vs 정산·회고 대상) 메뉴로 갈랐다.
 */
export default async function ClosingPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    q?: string;
    category?: string;
    universityType?: string;
    month?: string;
  }>;
}) {
  return (
    <ClosingScreen slug="closing" scope="closed" searchParams={searchParams} />
  );
}
