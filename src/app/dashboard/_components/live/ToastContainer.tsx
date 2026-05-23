"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Toast } from "./Toast";

type ToastEntry = { id: number; message: string; leaving: boolean };
type ToastCtx = { showToast: (message: string) => void };

const Ctx = createContext<ToastCtx | null>(null);

/** useToast — 자식 컴포넌트에서 토스트 표시. ToastProvider 안에서만 호출. */
export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast는 ToastProvider 안에서만 사용");
  return v;
}

let _id = 0;

/** ToastProvider — showToast 제공 + 우하단에 토스트 stack 렌더.
 *  3.5초 후 leaving=true → 0.3초 페이드아웃 → DOM 제거. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const showToast = useCallback((message: string) => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, message, leaving: false }]);
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 3500);
  }, []);

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} leaving={t.leaving} />
        ))}
      </div>
    </Ctx.Provider>
  );
}
