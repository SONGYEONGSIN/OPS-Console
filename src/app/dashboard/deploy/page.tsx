import { ClosingScreen } from "../closing/_ClosingScreen";

/**
 * 배포 · 운영 — **아직 마감 전인** 서비스. 지금 운영해야 할 대상이다.
 *
 * 서비스마감과 같은 목록(`closing_services`)을 보되 범위가 반대다. 화면 구성은
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
    <ClosingScreen slug="deploy" scope="open" searchParams={searchParams} />
  );
}
