import type { KpiItem } from "@/features/reports/schemas";
import { KpiCard } from "./KpiCard";
import { ServiceFlowCard } from "./ServiceFlowCard";
import { ContractSheetCard } from "./ContractSheetCard";

type Props = {
  kpis: KpiItem[];
  /** 추가 클래스 (예: 상단 여백) */
  className?: string;
};

/**
 * KPI 카드 그리드 — 서비스 오픈/마감은 ServiceFlowCard 하나로 통합해 표시.
 * 마감 KPI가 없는 구형 리포트는 오픈을 단일 KpiCard로 폴백 (하위호환).
 * 통합 카드는 오픈 위치(선두)에 배치, 나머지는 순서 유지.
 */
export function KpiGrid({ kpis, className = "" }: Props) {
  const open = kpis.find((k) => k.key === "service-open") ?? null;
  const close = kpis.find((k) => k.key === "service-close") ?? null;
  const rest = kpis.filter(
    (k) => k.key !== "service-open" && k.key !== "service-close",
  );

  return (
    <div
      className={`grid grid-cols-2 gap-3 md:grid-cols-4 ${className}`.trim()}
    >
      {open && close ? (
        <ServiceFlowCard open={open} close={close} />
      ) : open ? (
        <KpiCard item={open} />
      ) : null}
      {rest.map((kpi) =>
        kpi.key === "contract" && kpi.breakdown ? (
          <ContractSheetCard key={kpi.key} item={kpi} />
        ) : (
          <KpiCard key={kpi.key} item={kpi} />
        ),
      )}
    </div>
  );
}
