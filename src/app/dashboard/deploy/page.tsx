import { ClosingScreen } from "../closing/_ClosingScreen";

/**
 * 배포 · 운영 — **접수 중인** 서비스. 지금 돌보는 대상이다.
 *
 * 서비스마감·개발테스트와 같은 목록(`closing_services`)을 보되 단계가 다르다. 화면 구성은
 * 같으므로 `ClosingScreen` 을 그대로 쓴다 — 두 벌로 두면 한쪽만 고쳐진다.
 */
export default async function DeployPage({
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
    <ClosingScreen slug="deploy" scope="running" searchParams={searchParams} />
  );
}
