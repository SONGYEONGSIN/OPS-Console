import type { ReactNode } from "react";

type Props = {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  /** 헤더 영역 (마스트헤드 — 시각/시프트/본인) */
  header: ReactNode;
  /** 푸터 영역 (EventTicker) */
  ticker?: ReactNode;
};

/**
 * HudShell — 운영부 콕핏 3 zone layout.
 * 좌 (나) · 중 (운영부) · 우 (시스템).
 */
export function HudShell({ left, center, right, header, ticker }: Props) {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-cream px-6 py-3">
        {header}
      </header>
      <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden bg-line-soft lg:grid-cols-[260px_1fr_260px]">
        <section
          data-testid="hud-left"
          className="overflow-y-auto bg-cream p-4"
        >
          {left}
        </section>
        <section
          data-testid="hud-center"
          className="overflow-y-auto bg-cream p-4"
        >
          {center}
        </section>
        <section
          data-testid="hud-right"
          className="overflow-y-auto bg-cream p-4"
        >
          {right}
        </section>
      </div>
      {ticker ? (
        <footer
          data-testid="hud-ticker"
          className="border-t border-line bg-cream px-4 py-2"
        >
          {ticker}
        </footer>
      ) : null}
    </div>
  );
}
