"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

/** 끝나지 않는 저장을 기다리는 상한 — 서버 액션이 걸리면 제출을 무한히 잡아 두지 않는다. */
export const SETTLE_TIMEOUT_MS = 20_000;

export type SettleResult =
  | { status: "ok" }
  | { status: "failed"; message: string }
  | { status: "timeout" };

/**
 * 자동 저장(blur)·이미지 업로드가 끝나기 전에 [제출완료]가 눌려도, 실패한 저장이 남은 채로
 * 제출되지 않게 하는 등록부. 편집기가 저장을 `track` 하고, 제출 쪽이 `settle` 로 기다린다.
 *
 * 실패는 **저장하는 데이터의 키**(예: `note:{reportId}:{area}`)로 기록한다. 편집기 인스턴스로
 * 기록하면 탭을 옮겨 편집기가 사라질 때 실패가 같이 사라져, 저장 안 된 글이 제출된다.
 * 실패는 같은 키의 나중 저장이 성공해야만 지워진다.
 *
 * 상태가 아니라 ref 에 둔다 — blur 직후 같은 클릭에서 읽어야 해서 렌더를 기다릴 수 없다.
 */
export type SaveRegistry = {
  /** 저장 하나를 등록한다. work 는 실패 문구(성공이면 null)로 끝난다. */
  track: (key: string, label: string, work: Promise<string | null>) => void;
  hasPending: () => boolean;
  /** 진행 중인 저장이 모두 끝나길 기다린 뒤, 남은 실패가 있으면 알려 준다. */
  settle: (timeoutMs?: number) => Promise<SettleResult>;
};

const PendingSavesContext = createContext<SaveRegistry | null>(null);

export function usePendingSaves(): SaveRegistry | null {
  return useContext(PendingSavesContext);
}

export function PendingSavesProvider(props: {
  children: ReactNode;
  /** 테스트용 — 기본은 SETTLE_TIMEOUT_MS */
  timeoutMs?: number;
}) {
  const defaultTimeout = props.timeoutMs ?? SETTLE_TIMEOUT_MS;
  const inflight = useRef(new Set<Promise<string | null>>());
  const failures = useRef(new Map<string, string>());
  // 같은 키에서 가장 나중에 시작한 저장만 결과를 기록한다(먼저 시작한 저장이 늦게 끝나도 덮지 않는다).
  const latest = useRef(new Map<string, Promise<string | null>>());
  const registry = useMemo<SaveRegistry>(
    () => ({
      track(key, label, work) {
        const tracked: Promise<string | null> = work.then((error) => {
          if (latest.current.get(key) === tracked) {
            if (error === null) failures.current.delete(key);
            else failures.current.set(key, `${label}: ${error}`);
          }
          inflight.current.delete(tracked);
          return error;
        });
        latest.current.set(key, tracked);
        inflight.current.add(tracked);
      },
      hasPending: () => inflight.current.size > 0,
      async settle(timeoutMs = defaultTimeout) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<"timeout">((resolve) => {
          timer = setTimeout(() => resolve("timeout"), timeoutMs);
        });
        const drained = (async () => {
          for (;;) {
            while (inflight.current.size > 0) {
              await Promise.all([...inflight.current]);
            }
            // 업로드가 끝난 뒤 이어지는 저장이 같은 틱에 등록되므로 한 번 더 양보해 본다.
            await new Promise((r) => setTimeout(r, 0));
            if (inflight.current.size === 0) return "drained" as const;
          }
        })();
        try {
          const won = await Promise.race([drained, timeout]);
          if (won === "timeout") return { status: "timeout" };
        } finally {
          clearTimeout(timer);
        }
        const first = failures.current.values().next();
        return first.done === true
          ? { status: "ok" }
          : { status: "failed", message: first.value };
      },
    }),
    [defaultTimeout],
  );
  return (
    <PendingSavesContext.Provider value={registry}>
      {props.children}
    </PendingSavesContext.Provider>
  );
}
