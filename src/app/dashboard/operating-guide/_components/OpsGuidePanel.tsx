import type { OperatingGuideTab } from "../_data/tabs";

type Props = {
  tab: OperatingGuideTab;
};

/**
 * 운영 가이드 우측 패널.
 * /dashboard/settings 의 Panel 톤(PanelHeader + 구분선 행) 차용.
 */
export function OpsGuidePanel({ tab }: Props) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto">
      <header className="mb-2">
        <h3 className="text-xl font-semibold tracking-[-0.02em]">{tab.label}</h3>
        <p className="mt-1 text-xs text-muted">{tab.desc}</p>
      </header>

      <div className="flex flex-col gap-6">
        {tab.sections.map((section, idx) => (
          <section
            key={`${tab.value}-${idx}`}
            className="border-b border-line-soft pb-4 last:border-b-0"
          >
            <h4 className="mb-2 text-sm font-semibold text-ink">
              {section.heading}
            </h4>
            <div className="space-y-2 text-sm leading-relaxed text-ink-soft">
              {section.body.split("\n\n").map((para, pIdx) => (
                <p key={pIdx} className="whitespace-pre-line">
                  {para}
                </p>
              ))}
            </div>
            {section.links && section.links.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-3">
                {section.links.map((link, lIdx) => (
                  <a
                    key={lIdx}
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-xs text-vermilion hover:underline"
                  >
                    {link.label} →
                  </a>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
