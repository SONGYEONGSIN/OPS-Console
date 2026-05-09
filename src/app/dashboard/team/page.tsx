import { findSidebarMeta } from "../_data";
import { PAGE_META } from "../_data/page-meta-config";
import { derivePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { listOperators } from "@/features/operators/queries";
import {
  createOperator,
  updateOperator,
} from "@/features/operators/actions";
import type { OperatorRow } from "@/features/operators/schemas";

/**
 * /dashboard/team — 운영부 조직구성 (DB 연동, server component).
 */
export default async function TeamPage() {
  const slug = "team";
  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = PAGE_META[slug] ?? derivePageMeta(slug, meta);

  const operators = await listOperators();
  const rows: ListRow[] = operators.map(operatorToListRow);

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
    />
  );

  async function onPersist(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    if (isNew) {
      const result = await createOperator({
        email: row.id,
        name: row.name,
        team: (row.owner as OperatorRow["team"]) ?? "운영1팀",
        role: (row.meta as OperatorRow["role"]) ?? "매니저",
        emp_no: deriveEmpNo(),
        hired_at: todayKR(),
        birth_date: "1990-01-01",
        gender: "여",
        status: row.status,
        leader: row.leader ?? null,
      });
      return result.ok
        ? { ok: true }
        : { ok: false, error: result.error };
    }
    const all = await listOperators();
    const target = all.find((o) => o.email === row.id);
    if (!target) return { ok: false, error: "사용자를 찾을 수 없습니다." };
    const result = await updateOperator(target.id, {
      name: row.name,
      team: row.owner as OperatorRow["team"],
      role: (row.meta as OperatorRow["role"]) ?? target.role,
      status: row.status,
      leader: row.leader ?? null,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="team"
      onPersist={onPersist}
    />
  );
}

function operatorToListRow(op: OperatorRow): ListRow {
  return {
    id: op.email,
    name: op.name,
    status: op.status,
    owner: op.team,
    meta: op.role,
    leader: op.leader ?? undefined,
  };
}

function deriveEmpNo(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function todayKR(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}
