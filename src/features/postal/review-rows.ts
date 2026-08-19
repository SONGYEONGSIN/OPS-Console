import { assignDaySeq } from "./extract-parse";
import { matchAssignee, type AssigneeRow } from "./assignee-match";

/**
 * 판독 결과 → 검토 화면의 표 한 행.
 *
 * 담당자는 **유일할 때만 채운다.** 후보가 둘 이상이면(캠퍼스 분리 등) 비워두고
 * 후보만 넘긴다 — 자동으로 하나를 고르면 틀린 담당자가 조용히 들어가고,
 * 우편물이 엉뚱한 사람에게 간다.
 */

export type ExtractedItem = {
  tracking_no: string;
  fee: number | null;
  postal_code: string | null;
  recipient_org: string | null;
  recipient_name: string | null;
};

export type ReviewRow = {
  daySeq: number;
  trackingNo: string;
  fee: number | null;
  postalCode: string | null;
  recipientOrg: string | null;
  recipientName: string | null;
  /** 어느 시트를 봤나 — 화면에 '학부/대학원'으로 드러낸다. */
  basis: "undergraduate" | "graduate";
  assignee: string | null;
  candidates: AssigneeRow[];
};

export function buildReviewRows(
  items: ExtractedItem[],
  ctx: { under: AssigneeRow[]; grad: AssigneeRow[]; alreadyOnThatDay: number },
): ReviewRow[] {
  // 표시 순서도 등기번호 순으로 맞춘다 — 순번이 뒤섞여 보이면 읽기 어렵다.
  const sorted = [...items].sort((a, b) =>
    a.tracking_no.localeCompare(b.tracking_no),
  );
  const seqs = assignDaySeq(sorted, ctx.alreadyOnThatDay);

  return sorted.map((it, i) => {
    const m = matchAssignee(it.recipient_org ?? "", ctx.under, ctx.grad);
    return {
      daySeq: seqs[i],
      trackingNo: it.tracking_no,
      fee: it.fee,
      postalCode: it.postal_code,
      recipientOrg: it.recipient_org,
      recipientName: it.recipient_name,
      basis: m.basis,
      assignee: m.assignee,
      candidates: m.candidates,
    };
  });
}
