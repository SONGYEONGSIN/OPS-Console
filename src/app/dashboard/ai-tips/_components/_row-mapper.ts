import type { ListRow } from "../../_components/patterns/ListPattern";
import type { AiTipCandidateRow } from "@/features/ai-tip-candidates/schemas";

/**
 * TIP 후보 1건 → ListRow (variant="ai-tip-candidates").
 *
 * **`status` 는 항상 `active` 로 둔다.** 인스펙터 머리(`InspectorChrome`)가
 * `STATUS_LABEL[row.status]` 로 원형 배지를 그려서, 여기에 `pending`·`hidden`
 * 같은 도메인 상태를 넣으면 라벨표에 없는 값이라 엉뚱한 말이 뜬다. 검토 상태는
 * 별도 축(`tipCandidateStatus`)으로만 보낸다.
 *
 * **초안 제목이 없으면 `name` 은 빈 문자열이다.** 리포명으로 채우면 claude 초안
 * 생성이 실패했다는 사실이 가려져, 제목이 멀쩡한 후보처럼 보인다. 비어 있음을
 * 그대로 넘기고 표가 "초안 없음"이라고 말하게 한다.
 *
 * 초안 본문(`summary`/`reusePrompt`/`tags`/`aiTool`/`category`)은 **ai-work 가
 * 이미 쓰는 칸을 재사용**한다 — 등록되면 그대로 TIP 이 되는 값이라 칸을 두 벌로
 * 만들 이유가 없다.
 */
export function candidateToListRow(
  candidate: AiTipCandidateRow,
  canDecide: boolean,
): ListRow {
  return {
    id: candidate.id,
    name: candidate.draft_title ?? "",
    status: "active",
    // 후보에는 등록자가 없다 — 아직 아무도 자기 것이라 하지 않았다.
    owner: "",
    summary: candidate.draft_summary_md ?? "",
    reusePrompt: candidate.draft_reuse_prompt ?? null,
    tags: candidate.draft_tags,
    aiTool: candidate.draft_ai_tool ?? undefined,
    category: candidate.draft_category ?? undefined,
    tipCandidateStatus: candidate.status,
    tipCandidateRepoFullName: candidate.repo_full_name,
    tipCandidateRepoUrl: candidate.repo_url,
    tipCandidateRepoDescription: candidate.repo_description ?? null,
    tipCandidateStars: candidate.stars,
    tipCandidateCollectedAt: candidate.collected_at,
    // 없는 값은 null 그대로 보낸다 — 빈 문자열로 바꾸면 화면이 '조회했는데 비었다'로
    // 읽어 '안 물어봤다'와 구분이 사라진다.
    tipCandidateRepoLanguage: candidate.repo_language ?? null,
    tipCandidateRepoPushedAt: candidate.repo_pushed_at ?? null,
    tipCandidateRepoSyncedAt: candidate.repo_synced_at,
    tipCandidateCanDecide: canDecide,
  };
}
