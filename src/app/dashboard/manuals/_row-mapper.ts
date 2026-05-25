import type { ListRow } from "../_components/patterns/ListPattern";
import type { ManualRow } from "@/features/manuals/schemas";

export function manualRowToListRow(row: ManualRow): ListRow {
  return {
    id: row.id,
    name: row.name,
    status: "active",
    owner: "",
    manualKind: row.kind,
    manualCategory: row.category,
    manualSize: row.size,
    manualModified: row.lastModifiedDateTime,
    manualWebUrl: row.webUrl,
    manualParentItemId: row.parentItemId,
  };
}
