export type RightSystemStats = {
  shiftLabel: string;
  shiftProgressPct: number;
  onCallName: string;
  /** 0~4 dot, 4가 max */
  trafficLevel: 0 | 1 | 2 | 3 | 4;
  buildOk: boolean;
  deployOk: boolean;
  activeSessions: number;
  slaPct: number;
  alertCount: number;
};

/**
 * RightSystemPanel — HUD 우 zone. 시스템 헬스 + 시프트 + 온콜.
 * 위→아래로 정적 정보(시프트/온콜) → 라이브 신호(트래픽/SLA/세션) → 알림 카운트.
 */
export function RightSystemPanel({ stats }: { stats: RightSystemStats }) {
  return (
    <div className="space-y-5">
      <ZoneLabel kicker="시스템" title="라이브 신호" />

      <section className="space-y-3">
        <Row label="시프트">
          <span className="font-mono text-xs text-ink">{stats.shiftLabel}</span>
        </Row>
        <ProgressBar value={stats.shiftProgressPct} label="시프트 진행" />
        <Row label="온콜">
          <span className="text-sm font-bold text-ink">{stats.onCallName}</span>
        </Row>
      </section>

      <section className="space-y-3 border-t border-line-soft pt-3">
        <Row label="트래픽">
          <TrafficDots level={stats.trafficLevel} />
        </Row>
        <Row label="빌드">
          <StatusBadge ok={stats.buildOk} />
        </Row>
        <Row label="배포">
          <StatusBadge ok={stats.deployOk} />
        </Row>
        <Row label="활성 세션">
          <span className="font-mono text-sm font-bold text-ink">
            {stats.activeSessions}
          </span>
        </Row>
        <Row label="SLA">
          <span className="font-mono text-sm font-bold text-sage">
            {stats.slaPct.toFixed(1)}%
          </span>
        </Row>
      </section>

      <section className="border-t border-line-soft pt-3">
        <div className="flex items-center justify-between">
          <span className="text-2xs uppercase tracking-[0.14em] text-muted">
            오늘
          </span>
          <span
            className={`inline-block px-2 py-0.5 text-xs font-bold ${
              stats.alertCount > 0
                ? "bg-vermilion text-cream"
                : "bg-line-soft text-ink"
            }`}
          >
            알림 {stats.alertCount}건
          </span>
        </div>
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

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-2xs text-muted">
        <span>{label}</span>
        <span className="font-mono">{value}%</span>
      </div>
      <div className="h-1.5 w-full border border-line bg-cream">
        <div className="h-full bg-sage" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function TrafficDots({ level }: { level: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          aria-hidden
          className={`inline-block h-2 w-2 ${
            i <= level
              ? level >= 4
                ? "bg-vermilion"
                : level >= 3
                  ? "bg-ink"
                  : "bg-sage"
              : "border border-line bg-transparent"
          }`}
        />
      ))}
    </span>
  );
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 text-2xs font-bold ${
        ok ? "bg-sage text-cream" : "bg-vermilion text-cream"
      }`}
    >
      {ok ? "✓ OK" : "✗ FAIL"}
    </span>
  );
}
