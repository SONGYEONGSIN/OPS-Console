"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

/**
 * 자동 저장(blur)이 끝나기 전에 [제출완료]가 눌려도 저장이 빠진 채 제출되지 않게
 * 하는 등록부. 글 편집기가 저장을 `track` 하고, 제출 쪽이 `settle` 로 기다린다.
 * 상태가 아니라 ref 에 둔다 — blur 직후 같은 클릭에서 읽어야 해서 렌더를 기다릴 수 없다.
 */
export type SaveRegistry = {
  /** 저장 하나를 등록한다. 값은 실패 문구(성공이면 null). */
  track: (owner: symbol, work: Promise<string | null>) => void;
  /** 편집기가 사라졌다 — 그 편집기의 실패 기록을 지운다. */
  forget: (owner: symbol) => void;
  /** 진행 중인 저장이 모두 끝나길 기다린 뒤, 실패가 남아 있으면 그 문구를 준다. */
  settle: () => Promise<string | null>;
};

const PendingSavesContext = createContext<SaveRegistry | null>(null);

export function usePendingSaves(): SaveRegistry | null {
  return useContext(PendingSavesContext);
}

export function PendingSavesProvider({ children }: { children: ReactNode }) {
  const inflight = useRef(new Set<Promise<string | null>>());
  const failures = useRef(new Map<symbol, string>());
  const registry = useMemo<SaveRegistry>(
    () => ({
      track(owner, work) {
        // 결과 기록까지 끝난 뒤에 등록을 푼다 — settle 이 깨어났을 때 실패가 이미 적혀 있다.
        const tracked = work.then((error) => {
          if (error === null) failures.current.delete(owner);
          else failures.current.set(owner, error);
          inflight.current.delete(tracked);
          return error;
        });
        inflight.current.add(tracked);
      },
      forget(owner) {
        failures.current.delete(owner);
      },
      async settle() {
        while (inflight.current.size > 0) {
          await Promise.all([...inflight.current]);
        }
        const first = failures.current.values().next();
        return first.done === true ? null : first.value;
      },
    }),
    [],
  );
  return (
    <PendingSavesContext.Provider value={registry}>
      {children}
    </PendingSavesContext.Provider>
  );
}
