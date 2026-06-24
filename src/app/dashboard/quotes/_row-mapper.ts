import type { ListRow } from "../_components/patterns/ListPattern";
import type { QuoteRow } from "@/features/quotes/schemas";

/** quotes 상태 → ListRow.status(행 틴트). won=approved/sent=review/lost=inactive/draft=active. */
function tint(status: QuoteRow["status"]): ListRow["status"] {
  switch (status) {
    case "won":
      return "approved";
    case "sent":
      return "review";
    case "lost":
      return "inactive";
    default:
      return "active";
  }
}

export function quoteRowToListRow(q: QuoteRow): ListRow {
  return {
    id: q.id,
    name: q.customer,
    status: tint(q.status),
    owner: q.owner_email ?? "",
    quoteCustomer: q.customer,
    quoteDate: q.quote_date,
    quoteAmount: q.amount ?? null,
    quoteOwner: q.owner_email ?? "",
    quoteStatus: q.status,
    quoteValidUntil: q.valid_until ?? null,
    quoteNote: q.note ?? null,
  };
}
