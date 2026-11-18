import { useMemo, useSyncExternalStore } from "react";

// jsdom 의 history.replaceState 는 Next 의 useSearchParams 와 이어져 있지 않다.
// 실제 Next 가 하는 일(replaceState → useSearchParams 갱신)을 흉내 낸다.
const listeners = new Set<() => void>();
const original = window.history.replaceState.bind(window.history);
window.history.replaceState = (...a: Parameters<History["replaceState"]>) => {
  original(...a);
  listeners.forEach((l) => {
    l();
  });
};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function setUrl(search: string) {
  window.history.replaceState(null, "", `/dashboard/ops-weekly${search}`);
}

export const navigationModule = {
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => {
    const s = useSyncExternalStore(
      subscribe,
      () => window.location.search,
      () => "",
    );
    return useMemo(() => new URLSearchParams(s), [s]);
  },
};
