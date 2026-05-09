"use client";

import { useEffect, useState } from "react";

/**
 * AuthChrome — 로그인/비밀번호찾기/재설정 페이지 공통 chrome.
 * TitleBar(검정 상단) + StatusBar(검정 하단)를 한 곳에서 정의해서
 * AuthShell / login page에서 재사용.
 *
 * Clock: KST · 요일 · HH:mm. SSR-safe (now=null 시 ------).
 * StatusBar: 6개 실값 (online / host / TLS / lang / build / sha).
 */

export function AuthTitleBar() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-ink px-3.5 text-cream">
      <div />
      <div className="text-center text-md font-medium tracking-[0.02em]">
        운영부 상황실
      </div>
      <div className="ref text-xs text-faint tracking-[0.04em] text-right max-[479px]:text-[10px]">
        <Clock now={now} />
      </div>
    </div>
  );
}

function Clock({ now }: { now: Date | null }) {
  if (!now) return <>------ · --:-- KST</>;
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("ko-KR", { ...opts, timeZone: "Asia/Seoul" }).format(
      now,
    );
  const date = fmt({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
  const weekday = fmt({ weekday: "short" });
  const time = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
  return <>{`${date} · ${weekday} · ${time} KST`}</>;
}

export function AuthStatusBar() {
  // 브라우저 전용 값(navigator/window)을 SSR과 동일하게 렌더하면 hydration mismatch.
  // 마운트 후 useEffect에서 한 번에 실값으로 교체.
  const [client, setClient] = useState<{
    online: boolean;
    host: string;
    secure: boolean;
    lang: string;
  } | null>(null);

  useEffect(() => {
    const read = () => ({
      online: navigator.onLine,
      host: window.location.hostname || "localhost",
      secure: window.location.protocol === "https:",
      lang: navigator.language.toUpperCase(),
    });
    setClient(read());
    const onOnline = () => setClient((c) => (c ? { ...c, online: true } : c));
    const onOffline = () => setClient((c) => (c ? { ...c, online: false } : c));
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const online = client?.online ?? true;
  const host = client?.host ?? "";
  const secure = client?.secure ?? true;
  const lang = client?.lang ?? "";

  const buildVersion = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "?";
  const gitSha = process.env.NEXT_PUBLIC_GIT_SHA ?? "unknown";

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5 border-t border-line bg-ink px-4 text-xs tracking-[0.02em] text-cream/75 max-md:gap-3 max-md:px-3">
      <div className="flex items-center gap-5">
        <span className="flex items-center">
          <span
            aria-hidden
            className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
              online
                ? "bg-sage [box-shadow:var(--shadow-led-sage)]"
                : "bg-vermilion [box-shadow:var(--shadow-led-vermilion)]"
            }`}
          />
          <span>{online ? "연결됨" : "오프라인"}</span>
        </span>
        <span>
          <strong className="mr-1 font-medium text-cream">서버</strong>
          {host}
        </span>
      </div>
      <div className="flex items-center justify-center gap-5 max-md:hidden">
        <span>{secure ? "TLS · HSTS" : "HTTP"}</span>
        <span>{lang} · UTF-8</span>
      </div>
      <div className="flex items-center justify-end gap-5">
        <span className="max-[479px]:hidden">
          <strong className="mr-1 font-medium text-cream">빌드</strong>v {buildVersion}
        </span>
        <span className="code">sha {gitSha}</span>
      </div>
    </div>
  );
}
