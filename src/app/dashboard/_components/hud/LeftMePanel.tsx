type MyActivity = { ts: string; who: string; act: string };

export type LeftMeStats = {
  todoTodayCount: number;
  todoWeekCount: number;
  servicesMineCount: number;
  handoverInProgressCount: number;
  receivablesPendingCount: number;
  myActivities: MyActivity[];
};

/**
 * LeftMePanel — HUD 좌 zone. 본인 중심 KPI 4종 + 내 활동 스트림.
 *
 * 4 카운트 (todoToday / services 담당 / handover 진행 / receivables 발송 대기)와
 * 내 활동 mini feed로 "오늘 나는 무엇을 봐야 하나"를 즉각 인지.
 */
export function LeftMePanel({ stats }: { stats: LeftMeStats }) {
  return (
    <div className="space-y-5">
      <ZoneLabel kicker="나" title="개인 신호" />

      <div className="grid grid-cols-2 gap-2">
        <Kpi
          label="할 일 · 오늘"
          value={stats.todoTodayCount}
          sub={`이번 주 ${stats.todoWeekCount}`}
          tone="urgent"
        />
        <Kpi
          label="담당 서비스"
          value={stats.servicesMineCount}
          sub="services"
          tone="neutral"
        />
        <Kpi
          label="인수인계 진행"
          value={stats.handoverInProgressCount}
          sub="handover"
          tone="neutral"
        />
        <Kpi
          label="미수 발송"
          value={stats.receivablesPendingCount}
          sub="receivables"
          tone={stats.receivablesPendingCount > 0 ? "warn" : "neutral"}
        />
      </div>

      <section className="space-y-2">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">
          내 활동
        </p>
        <ul className="space-y-1">
          {stats.myActivities.length === 0 ? (
            <li className="text-xs text-muted">활동 없음</li>
          ) : (
            stats.myActivities.map((a, i) => (
              <li
                key={i}
                className="flex items-baseline gap-2 border-l-2 border-line-soft pl-2 text-xs"
              >
                <span className="font-mono text-2xs text-muted">{a.ts}</span>
                <span className="text-ink">{a.act}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

function ZoneLabel({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-line-soft pb-1.5">
      <span className="font-mono text-2xs uppercase tracking-[0.22em] text-vermilion">
        {kicker}
      </span>
      <h3 className="text-sm font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h3>
    </div>
  );
}

const TONE_BG: Record<"urgent" | "warn" | "neutral", string> = {
  urgent: "border-vermilion",
  warn: "border-vermilion-deep",
  neutral: "border-line",
};

const TONE_VALUE: Record<"urgent" | "warn" | "neutral", string> = {
  urgent: "text-vermilion",
  warn: "text-vermilion-deep",
  neutral: "text-ink",
};

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone: "urgent" | "warn" | "neutral";
}) {
  return (
    <div className={`border bg-cream px-3 py-2 ${TONE_BG[tone]}`}>
      <p className="text-2xs uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className={`mt-0.5 font-mono text-2xl font-bold ${TONE_VALUE[tone]}`}>
        {value}
      </p>
      <p className="text-2xs text-muted">{sub}</p>
    </div>
  );
}
