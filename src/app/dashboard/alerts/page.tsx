import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { alertsWidgets } from "../_data/patterns";
import type { DashWidget } from "../_components/patterns/DashPattern";
import { requireMenu } from "@/features/auth/menu-guard";

const TONE_META: Record<
  DashWidget["tone"],
  { label: string; description: string; border: string; accent: string; chip: string }
> = {
  urgent: {
    label: "긴급",
    description: "즉시 확인 필요",
    border: "border-vermilion",
    accent: "text-vermilion",
    chip: "bg-vermilion text-cream",
  },
  review: {
    label: "검토",
    description: "처리 대기 · 검토 필요",
    border: "border-line",
    accent: "text-ink",
    chip: "bg-washi-raised text-ink",
  },
  ok: {
    label: "정상",
    description: "처리 완료 · 안정",
    border: "border-line-soft",
    accent: "text-sage",
    chip: "bg-sage text-cream",
  },
};

const TONE_ORDER: DashWidget["tone"][] = ["urgent", "review", "ok"];

export default async function AlertsPage() {
  const slug = "alerts";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta, alertsWidgets.length);

  const grouped: Record<DashWidget["tone"], DashWidget[]> = {
    urgent: [],
    review: [],
    ok: [],
  };
  for (const w of alertsWidgets) grouped[w.tone].push(w);

  return (
    <div>
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <section className="grid grid-cols-1 gap-4 p-7 md:grid-cols-3">
        {TONE_ORDER.map((tone) => {
          const t = TONE_META[tone];
          const items = grouped[tone];
          return (
            <article
              key={tone}
              className={`flex flex-col border ${t.border} bg-cream`}
              data-testid={`alerts-card-${tone}`}
            >
              <header className="flex items-baseline justify-between border-b border-line-soft px-4 py-3">
                <div className="flex items-baseline gap-2">
                  <h3 className={`text-base font-bold ${t.accent}`}>
                    {t.label}
                  </h3>
                  <span className="text-xs text-muted">· {t.description}</span>
                </div>
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-bold ${t.chip}`}
                >
                  {items.length}건
                </span>
              </header>
              <ul className="flex flex-1 flex-col">
                {items.length === 0 ? (
                  <li className="px-4 py-6 text-center text-xs text-muted">
                    항목 없음
                  </li>
                ) : (
                  items.map((w) => (
                    <li
                      key={w.id}
                      className="flex items-baseline justify-between border-b border-line-soft px-4 py-3 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{w.label}</p>
                        <p className="text-2xs text-muted">{w.time}</p>
                      </div>
                      <span className="ml-3 shrink-0 text-sm font-bold text-ink">
                        {w.value}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </article>
          );
        })}
      </section>
    </div>
  );
}
