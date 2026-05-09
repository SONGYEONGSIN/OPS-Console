import Link from "next/link";
import { PageHeader } from "../_components/page-header/PageHeader";
import { listDeletedOperators } from "@/features/operators/queries";
import { restoreOperator } from "@/features/operators/actions";
import type { OperatorRow } from "@/features/operators/schemas";

/**
 * /dashboard/team-deleted — 삭제된 운영자 목록 (별도 보기).
 * 삭제 사유 + 시각 표시. 복구 server action.
 */
export default async function DeletedTeamPage() {
  const rows = await listDeletedOperators();

  return (
    <>
      <PageHeader
        pathname="/dashboard/team-deleted"
        meta={[
          { label: "관리", tone: "accent" },
          { label: "삭제된 계정" },
          { label: `${rows.length}건` },
        ]}
        headline={{ accent: "조직 · 권한", title: "삭제된 계정" }}
        description="권한이 회수된 계정 이력입니다. 복구하려면 우측 액션을 사용하세요."
      />
      <section className="bg-cream p-7">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">
            삭제 이력
            <span className="ml-2 text-sm font-normal text-vermilion">
              {rows.length}건
            </span>
          </h2>
          <Link
            href="/dashboard/team"
            className="text-xs text-muted underline hover:text-ink"
          >
            ← 활성 목록으로
          </Link>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                <th className="px-3 py-2">팀</th>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">직급</th>
                <th className="px-3 py-2">이메일</th>
                <th className="px-3 py-2">삭제 사유</th>
                <th className="px-3 py-2">삭제 시각</th>
                <th className="px-3 py-2 text-right">액션</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted">
                    삭제 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((op) => (
                  <DeletedRow key={op.id} op={op} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function DeletedRow({ op }: { op: OperatorRow }) {
  async function onRestore() {
    "use server";
    await restoreOperator(op.id);
  }

  return (
    <tr className="border-b border-line-soft hover:bg-washi-raised">
      <td className="px-3 py-2 text-sm text-ink-soft">{op.team}</td>
      <td className="px-3 py-2 font-medium text-ink">{op.name}</td>
      <td className="px-3 py-2 text-sm text-ink-soft">{op.role}</td>
      <td className="px-3 py-2 font-mono text-xs text-muted">{op.email}</td>
      <td className="px-3 py-2 text-sm text-ink-soft">
        {op.deleted_reason ?? "-"}
      </td>
      <td className="px-3 py-2 text-xs text-muted">
        {op.deleted_at ? formatKR(op.deleted_at) : "-"}
      </td>
      <td className="px-3 py-2 text-right">
        <form action={onRestore}>
          <button
            type="submit"
            className="cursor-pointer border border-vermilion bg-transparent px-3 py-1 text-xs font-medium text-vermilion hover:bg-vermilion hover:text-cream"
          >
            복구
          </button>
        </form>
      </td>
    </tr>
  );
}

function formatKR(iso: string): string {
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(new Date(iso));
}
