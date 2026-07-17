import { notFound } from "next/navigation";
import { getTeamBriefingByShareToken } from "@/features/team-briefings/queries";
import { BriefingNewsletter } from "./_components/BriefingNewsletter";

/**
 * 팀 브리핑 뉴스레터 게스트 view — 인증 없이 토큰으로 조회.
 * proxy.ts PUBLIC_PATHS "/r" prefix에 포함. 무효 토큰은 404.
 */
export default async function SharedBriefingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const briefing = await getTeamBriefingByShareToken(token);
  if (!briefing) notFound();

  return (
    // 스티비 레퍼런스 클론 — 흰 바탕 단일 컬럼 (앱 브랜드와 분리된 발행물 스킨)
    <main className="min-h-screen bg-white">
      <BriefingNewsletter
        issueNo={briefing.issueNo}
        payload={briefing.payload}
      />
    </main>
  );
}
