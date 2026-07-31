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
      {/* 초안 링크를 실수로 공유해도 오해가 없도록 발행 전임을 명시한다. */}
      {briefing.status === "draft" && (
        <div className="border-b border-line bg-situation-bg px-4 py-3 text-center text-sm text-vermilion">
          초안입니다 — 아직 발행되지 않았습니다.
        </div>
      )}
      <BriefingNewsletter
        issueNo={briefing.issueNo}
        payload={briefing.payload}
      />
    </main>
  );
}
