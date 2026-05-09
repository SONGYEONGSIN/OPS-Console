"use client";

import { useEffect, useState } from "react";

/**
 * forgot-password / reset-password 페이지의 공통 셸.
 *
 * Layout: TitleBar (시계 포함) + 중앙 정렬 폼 영역 + StatusBar.
 * BrandPanel은 의도적으로 제외 — 짧은 transactional 흐름이라 BrandPanel 비례 부담스러움.
 *
 * children에 폼 본문 (max-w-[420px] 셸 안에서).
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const updateNow = () => setNow(new Date());
    updateNow();
    const id = setInterval(updateNow, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative z-10 grid h-screen grid-rows-[34px_1fr_26px]">
      <TitleBar now={now} />
      <main className="flex items-center justify-center overflow-y-auto bg-cream px-4 py-5 md:px-5 md:py-6 lg:px-7 lg:py-8">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
      <StatusBar />
    </div>
  );
}

function TitleBar({ now }: { now: Date | null }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center border-b border-line bg-ink px-3.5 text-cream">
      <div className="mr-[18px] flex gap-[7px] max-[479px]:hidden">
        <span className="h-3 w-3 rounded-full border border-cream/20 bg-vermilion" />
        <span className="h-3 w-3 rounded-full border border-cream/20 bg-gold" />
        <span className="h-3 w-3 rounded-full border border-cream/20 bg-sage" />
      </div>
      <div className="text-center text-md font-medium tracking-[0.02em]">
        운영부 <em className="not-italic text-vermilion mx-[3px]">·</em> 로그인
        <span className="ml-1.5 text-sm text-faint max-md:hidden">OPSROOM</span>
      </div>
      <div className="ref text-xs text-faint tracking-[0.04em] max-[479px]:text-[10px]">
        <Clock now={now} />
      </div>
    </div>
  );
}

function Clock({ now }: { now: Date | null }) {
  if (!now) return <>------ · --:-- KST</>;
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("ko-KR", { ...opts, timeZone: "Asia/Seoul" }).format(
      now
    );
  const date = fmt({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
  const time = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
  return <>{`${date} · ${time} KST`}</>;
}

function StatusBar() {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5 border-t border-line bg-washi-raised px-4 text-xs tracking-[0.02em] text-muted max-md:gap-3 max-md:px-3">
      <div className="flex items-center gap-5">
        <span className="flex items-center">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-sage [box-shadow:var(--shadow-led-sage)]" />
          <span>연결됨</span>
        </span>
        <span>
          <strong className="mr-1 font-medium text-ink-soft">서버</strong>
          auth.opsroom.local
        </span>
      </div>
      <div className="flex items-center justify-center gap-5 max-md:hidden">
        <span>TLS 1.3 · HSTS</span>
        <span>KR / EN · UTF-8</span>
      </div>
      <div className="flex items-center justify-end gap-5">
        <span className="max-[479px]:hidden">
          <strong className="mr-1 font-medium text-ink-soft">빌드</strong>v 4.2.1
        </span>
        <span className="code">sha 8c3f2a1</span>
      </div>
    </div>
  );
}
