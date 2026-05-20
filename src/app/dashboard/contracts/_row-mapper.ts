import type { ListRow } from "../_components/patterns/ListPattern";
import type { ContractRow } from "@/features/contracts/schemas";

export function contractsRowToListRow(r: ContractRow): ListRow {
  return {
    id: r.id,
    name: r.name,
    status: "active",
    owner: r.operator || "-",
    contractSheet: r.sheet,
    numbering: r.numbering,
    contractStatus: r.status,
    serviceActive: r.serviceActive,
    feeAmount: r.feeAmount,
    contractRaw: r.raw,
    contractsSheet: r.sheet,
    contractsCellOperator: r.cellAddress.operator,
    contractsCellStatus: r.cellAddress.status,
    contractsCellServiceActive: r.cellAddress.serviceActive,
    contractsCellFeeAmount: r.cellAddress.feeAmount,
  };
}
