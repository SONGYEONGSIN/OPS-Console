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

/** 좌측 요약 클러스터 — 시스템 날씨 + 요약 + LED 점등 (status line 왼쪽 고정). */
export function HealthGateway({ items }: Props) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <span className="text-sm font-bold text-ink-soft">시스템 날씨</span>
      <span className="text-sm font-bold text-gold">{summarize(items)}</span>
      <span className="flex gap-1.5">
        {items.map((item) => (
          <span
            key={item.label}
            data-gateway-led
            title={`${item.label} — ${item.detail}`}
            className={`inline-block h-2.5 w-2.5 cursor-default rounded-full ${LED_COLOR[item.tone]}`}
          />
        ))}
      </span>
    </div>
  );
}

/** ▾상세 펼침 패널 — 7개 항목 LED + 라벨 + detail. 토글 상태는 호출처가 관리. */
export function HealthDetailList({ items }: Props) {
  return (
    <ul className="mt-2 flex flex-col gap-1.5 border-t border-line-soft pt-2 pb-1">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-2 text-xs text-ink-soft"
        >
          <span
            aria-hidden
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${LED_COLOR[item.tone]}`}
          />
          <span className="font-semibold text-ink">{item.label}</span>
          <span className="text-muted">— {item.detail}</span>
        </li>
      ))}
    </ul>
  );
}
