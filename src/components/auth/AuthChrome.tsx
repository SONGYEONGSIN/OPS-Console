"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

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

type ClientChrome = {
  online: boolean;
  host: string;
  secure: boolean;
  lang: string;
};

// useSyncExternalStore가 매 렌더마다 getSnapshot을 호출하므로 동일 결과는 같은 참조를 반환해야 한다.
// 모듈 스코프 캐시로 안정 참조 유지.
let cachedSnapshot: ClientChrome | null = null;
function getClientSnapshot(): ClientChrome {
  const next: ClientChrome = {
    online: navigator.onLine,
    host: window.location.hostname || "localhost",
    secure: window.location.protocol === "https:",
    lang: navigator.language.toUpperCase(),
  };
  if (
    cachedSnapshot &&
    cachedSnapshot.online === next.online &&
    cachedSnapshot.host === next.host &&
    cachedSnapshot.secure === next.secure &&
    cachedSnapshot.lang === next.lang
  ) {
    return cachedSnapshot;
  }
  cachedSnapshot = next;
  return cachedSnapshot;
}
function getServerSnapshot(): ClientChrome | null {
  return null;
}
function subscribeOnlineStatus(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function AuthStatusBar() {
  // 브라우저 전용 값(navigator/window) SSR 안전 — useSyncExternalStore가 server snapshot=null로 hydration mismatch 방지.
  const client = useSyncExternalStore(
    subscribeOnlineStatus,
    getClientSnapshot,
    getServerSnapshot,
  );

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
