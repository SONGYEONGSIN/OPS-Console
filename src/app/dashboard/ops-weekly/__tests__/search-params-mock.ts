import { useMemo, useSyncExternalStore } from "react";

// jsdom 의 history.replaceState 는 Next 의 useSearchParams 와 이어져 있지 않다.
// 실제 Next 가 하는 일(replaceState → useSearchParams 갱신)을 흉내 낸다.
// 한계: 여기서는 동기로 알리지만 Next 는 startTransition 안에서 맞춘다 — 그래서 transition 지연으로
// 생기는 버그는 이 mock 으로 못 잡는다(use-ops-sub 의 setSub 가 상태가 아니라 location 을 읽는 이유).
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
