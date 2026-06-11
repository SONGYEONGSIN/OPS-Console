/**
 * HealthGateway — 시스템 게이트웨이 상태(우측 세로 SystemHealthPanel)를
 * 상단 커맨드바용 요약 한 줄로 압축한 표시 컴포넌트.
 *
 * 데이터 출처: `SystemHealthSnapshot` (`@/features/system-health/queries`).
 * 스냅샷은 { graph, sharepoint, sso, supabase, cron, youtube } = ProbeResult{ok, detail}
 * + mail = MailStats 형태로, SystemHealthPanel 내부에서 각 항목을 (label, 정상여부, detail)
 * 로 풀어 렌더한다. 이 컴포넌트는 그 정규화된 항목 배열을 props로 받는다 —
 * snapshot → HealthGatewayItem[] 매핑은 호출자(page.tsx)가 담당한다.
 */

/** 게이트웨이 한 항목 — SystemHealthPanel의 li 한 줄에 대응. */
export type HealthGatewayItem = {
  /** 항목 라벨 (예: "Supabase Connection") */
  label: string;
  /** ok=정상 / warn=지연·경고 / critical=이상 */
  tone: "ok" | "warn" | "critical";
  /** 한 줄 상세 (ProbeResult.detail 또는 메일 발송률 문자열) */
  detail: string;
};

type Props = { items: HealthGatewayItem[] };

const LED_COLOR: Record<HealthGatewayItem["tone"], string> = {
  ok: "bg-sage shadow-led-sage",
  // 일회성: amber LED glow — design-tokens에 amber shadow 토큰이 없어
  //   HealthLed/.weather .y 의 glow 패턴(--amber 5px)을 그대로 사용
  warn: "bg-amber shadow-[0_0_5px_var(--amber)]",
  critical: "bg-vermilion shadow-led-vermilion",
};

/** 비정상(warn=지연 / critical=이상) 항목만 요약 카운트 대상. */
function summarize(items: HealthGatewayItem[]): string {
  const critical = items.filter((i) => i.tone === "critical").length;
  const warn = items.filter((i) => i.tone === "warn").length;
  if (critical > 0) return `🌧 ${critical} 이상`;
  if (warn > 0) return `⛅ 맑음 · ${warn} 지연`;
  return "☀ 맑음";
}

export function HealthGateway({ items }: Props) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line-soft px-4 py-[7px]">
      <span className="text-xs font-bold text-muted">시스템 날씨</span>
      <span className="text-sm font-bold text-gold">{summarize(items)}</span>
      <span className="ml-1.5 flex gap-[5px]">
        {items.map((item) => (
          <span
            key={item.label}
            data-gateway-led
            title={`${item.label} — ${item.detail}`}
            className={`inline-block h-2 w-2 cursor-default rounded-full ${LED_COLOR[item.tone]}`}
          />
        ))}
      </span>
      <span className="ml-auto text-2xs text-muted">▾ 상세</span>
    </div>
  );
}
