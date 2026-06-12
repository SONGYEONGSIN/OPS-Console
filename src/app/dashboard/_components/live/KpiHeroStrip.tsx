import Link from "next/link";
import { Sparkline } from "./Sparkline";

type Kpi = {
  sago: { count: number; sparklineD: string };
  todo: { count: number; done: number; total: number };
  service: { count: number; sparklineD: string };
};

/**
 * KPI 히어로 스트립 — 상단 한눈 지표 3종 (사고 미해결 / 내 할 일 / 서비스 마감예정).
 * 집계 숫자 + 미니 스파크라인/진행률. 트리아지 '지금 당장'(목록)·현황 요약(타 도메인)과
 * 역할이 겹치지 않는 '핵심 지표' 띠. 각 타일은 해당 도메인으로 이동하는 Link.
 */
export function KpiHeroStrip({ kpi }: { kpi: Kpi }) {
  const { sago, todo, service } = kpi;
  const donePct =
    todo.total > 0 ? Math.round((todo.done / todo.total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 border-2 border-ink bg-cream sm:grid-cols-3">
      <Link
        href="/dashboard/incidents"
        className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-washi-raised"
      >
        <div className="min-w-0">
          <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
            사고 미해결
          </span>
          <span className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-bold leading-none tracking-[-0.04em] text-vermilion tabular-nums">
              {sago.count}
            </span>
            <span className="text-xs text-muted">건</span>
          </span>
          <span className="mt-1 block text-[9px] text-faint">
            즉시 확인 필요
          </span>
        </div>
        <Sparkline d={sago.sparklineD} variant="danger" />
      </Link>

      <Link
        href="/dashboard/my-todo"
        className="flex items-center justify-between gap-3 border-line-soft px-5 py-3.5 transition-colors hover:bg-washi-raised sm:border-l"
      >
        <div className="min-w-0">
          <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
            내 할 일
          </span>
          <span className="mt-1 flex items-baseline gap-0.5">
            <span className="text-3xl font-bold leading-none tracking-[-0.04em] text-ink tabular-nums">
              {todo.done}
            </span>
            <span className="text-xl font-bold leading-none text-muted tabular-nums">
              /{todo.total}
            </span>
          </span>
          <span className="mt-1 block text-[9px] text-faint">
            {donePct}% 완료
          </span>
        </div>
      </Link>

      <Link
        href="/dashboard/services"
        className="flex items-center justify-between gap-3 border-line-soft px-5 py-3.5 transition-colors hover:bg-washi-raised sm:border-l"
      >
        <div className="min-w-0">
          <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
            서비스 마감예정
          </span>
          <span className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-bold leading-none tracking-[-0.04em] text-ink tabular-nums">
              {service.count}
            </span>
            <span className="text-xs text-muted">건</span>
          </span>
          <span className="mt-1 block text-[9px] text-faint">D-7 내 마감</span>
        </div>
        <Sparkline d={service.sparklineD} variant="neutral" />
      </Link>
    </div>
  );
}
