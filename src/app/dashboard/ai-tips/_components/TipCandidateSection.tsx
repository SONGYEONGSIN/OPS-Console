import { ListPattern } from "../../_components/patterns/ListPattern";
import type { ListRow } from "../../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { paginateRows, DEFAULT_PAGE_SIZE } from "@/lib/list/paginate";
import {
  CANDIDATE_STATUSES,
  type AiTipCandidateRow,
  type CandidateStatus,
} from "@/features/ai-tip-candidates/schemas";
import { resolveCandidateScope } from "@/features/ai-tip-candidates/scope";
import { CandidateScopeChips } from "./CandidateScopeChips";
import { candidateToListRow } from "./_row-mapper";

type Props = {
  /**
   * 후보 **전건**. 페이지가 한 번 읽어 넘긴다 — 여기서 또 읽으면 헤더 건수와
   * 목록이 서로 다른 시점을 보게 된다(수집 잡이 도는 중이면 실제로 갈린다).
   */
  candidates: AiTipCandidateRow[];
  /** 주소의 `?scope` 원본. 모르는 값은 기본(검토 대기)으로 떨어진다. */
  scope?: string;
  page?: string;
  /** 등록·숨김·되돌리기 권한. viewer 면 false — 인스펙터가 버튼을 가린다. */
  canDecide: boolean;
};

/** 상태별 건수 — **전건 기준**. 걸러진 뒤를 세면 지금 칸 말고는 늘 0 이 된다. */
export function countByStatus(
  candidates: AiTipCandidateRow[],
): Record<CandidateStatus, number> {
  const counts = Object.fromEntries(
    CANDIDATE_STATUSES.map((s) => [s, 0]),
  ) as Record<CandidateStatus, number>;
  for (const c of candidates) counts[c.status] += 1;
  return counts;
}

/** 지금 칸에 해당하는 후보. */
export function filterByScope(
  candidates: AiTipCandidateRow[],
  scope: string | undefined,
): AiTipCandidateRow[] {
  const current = resolveCandidateScope(scope);
  return candidates.filter((c) => c.status === current);
}

/**
 * TIP 후보 탭 — 표준 목록 + 인스펙터.
 *
 * 전에는 등록된 TIP 목록 **아래에 붙은 패널**이었다. 검토 대기만 다룰 수 있어
 * 숨긴 후보를 되돌릴 자리가 없었고(수집기가 숨긴 리포를 다시 안 가져오므로
 * 숨김이 곧 영구 삭제였다), 목록·인스펙터 표준과도 따로 놀았다.
 */
export function TipCandidateSection({
  candidates,
  scope,
  page,
  canDecide,
}: Props) {
  const counts = countByStatus(candidates);
  const scoped = filterByScope(candidates, scope);
  const { rows, total } = paginateRows(scoped, page);
  const listRows: ListRow[] = rows.map((c) => candidateToListRow(c, canDecide));

  return (
    <ListPattern
      title="TIP 후보"
      data={{ rows: listRows }}
      variant="ai-tip-candidates"
      // 후보는 수집 잡이 적재한다 — 화면에서 만들거나 고치지 않는다.
      readOnly
      liveData
      inlineFilters={
        <CandidateScopeChips key="ai-tip-candidates-scope" counts={counts} />
      }
      footer={
        <ListPagination
          key="ai-tip-candidates-pagination"
          total={total}
          pageSize={DEFAULT_PAGE_SIZE}
        />
      }
    />
  );
}
