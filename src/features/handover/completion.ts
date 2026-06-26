import { HANDOVER_FIELD_KEYS, type HandoverFieldKey } from "./categories";

/**
 * 인수인계 필드 완료 판정 (서버/status 산정용 단일 소스).
 *
 * 6개 구조화 필드(계약정보·계약자료·정산-수수료·정산-세금계산서·학교담당자·서류)는
 * `*_md` 원문이 아니라 **구조화 데이터**로 채움 여부를 판정한다. 인스펙터 UI 배지
 * (list-variants/handover/progress.ts `isFieldFilled`)와 동일 규칙 — UI는 "작성완료"인데
 * status는 "작성중"이 되는 불일치를 막는다.
 */
type CompletionData = {
  contract_info?: {
    title?: string | null;
    type?: string | null;
    progress?: string | null;
    status?: string | null;
    memo?: string | null;
  } | null;
  contract_data_checklist?: { text?: string | null }[] | null;
  docs_checklist?: { text?: string | null }[] | null;
  payment_fee?: { deadline?: string | null; memo?: string | null } | null;
  payment_invoice?: { issueType?: string | null; memo?: string | null } | null;
  school_contacts?: unknown[] | null;
  [key: string]: unknown;
};

function nonEmpty(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

export function isHandoverFieldComplete(
  d: CompletionData,
  key: HandoverFieldKey,
): boolean {
  switch (key) {
    case "contract_info_md": {
      const c = d.contract_info;
      return (
        !!c && [c.title, c.type, c.progress, c.status, c.memo].some(nonEmpty)
      );
    }
    case "contract_data_md":
      return (
        (d.contract_data_checklist ?? []).some((c) => nonEmpty(c?.text)) ||
        nonEmpty(d.contract_data_md)
      );
    case "docs_md":
      return (
        (d.docs_checklist ?? []).some((c) => nonEmpty(c?.text)) ||
        nonEmpty(d.docs_md)
      );
    case "payment_fee_md": {
      const p = d.payment_fee;
      return !!p && [p.deadline, p.memo].some(nonEmpty);
    }
    case "payment_invoice_md": {
      const p = d.payment_invoice;
      return !!p && [p.issueType, p.memo].some(nonEmpty);
    }
    case "school_contact_md":
      return (d.school_contacts ?? []).length > 0;
    default:
      return nonEmpty(d[key]);
  }
}

/** 14필드 모두 완료면 true (status 'ready' 판정). */
export function isHandoverRecordComplete(d: CompletionData): boolean {
  return HANDOVER_FIELD_KEYS.every((k) => isHandoverFieldComplete(d, k));
}
