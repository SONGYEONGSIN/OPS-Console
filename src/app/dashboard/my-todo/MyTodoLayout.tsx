"use client";

import { useMemo, useState, useTransition } from "react";

export type UpcomingService = {
  id: string;
  service_id: number;
  university_name: string;
  service_name: string;
  application_type: string;
  write_start_at: string;
};

export type TodoItem = {
  id: string;
  title: string;
  body: string | null;
  done: boolean;
  done_at: string | null;
  priority: "low" | "medium" | "high";
  source_service_id: string | null;
};

type Props = {
  services: UpcomingService[];
  todos: TodoItem[];
  onAddFromService: (
    service: UpcomingService,
  ) => Promise<{ ok: boolean; error?: string }>;
  onToggleDone: (
    id: string,
    done: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  onDeleteTodo: (id: string) => Promise<{ ok: boolean; error?: string }>;
};

const PRIORITY_LABEL: Record<TodoItem["priority"], string> = {
  high: "높음",
  medium: "중간",
  low: "낮음",
};

const PRIORITY_TONE: Record<TodoItem["priority"], string> = {
  high: "text-vermilion",
  medium: "text-gold",
  low: "text-muted",
};

function dDayFrom(today: Date, target: string): number {
  const t = new Date(target);
  const diff = Math.ceil((t.getTime() - today.getTime()) / 86_400_000);
  return diff;
}

function priorityFromDDay(d: number): TodoItem["priority"] {
  if (d <= 7) return "high";
  if (d <= 30) return "medium";
  return "low";
}

export function MyTodoLayout({
  services,
  todos,
  onAddFromService,
  onToggleDone,
  onDeleteTodo,
}: Props) {
  const today = useMemo(() => new Date(), []);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const [busyService, setBusyService] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const stats = useMemo(() => {
    const total = todos.length;
    const done = todos.filter((t) => t.done).length;
    const inProgress = todos.filter((t) => !t.done).length;
    const notStarted = 0;
    const completionRate = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, notStarted, inProgress, done, completionRate };
  }, [todos]);

  const doneServiceIds = useMemo(
    () =>
      new Set(
        todos
          .filter((t) => t.done && t.source_service_id)
          .map((t) => t.source_service_id as string),
      ),
    [todos],
  );
  const linkedServiceIds = useMemo(
    () =>
      new Set(
        todos
          .filter((t) => t.source_service_id)
          .map((t) => t.source_service_id as string),
      ),
    [todos],
  );

  const handleAddService = (svc: UpcomingService) => {
    setError(null);
    setBusyService(svc.id);
    startTransition(async () => {
      const r = await onAddFromService(svc);
      setBusyService(null);
      if (!r.ok) setError(r.error ?? "추가 실패");
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropOver(false);
    const id = e.dataTransfer.getData("text/x-service-id");
    if (!id) return;
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    handleAddService(svc);
  };

  return (
    <section className="flex h-full min-h-0 flex-col p-5 md:p-6 lg:p-7">
      <header className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCircle label="전체" value={stats.total} tone="ink" />
        <StatCircle label="시작 전" value={stats.notStarted} tone="muted" />
        <StatCircle label="진행 중" value={stats.inProgress} tone="gold" />
        <StatCircle
          label="완료"
          value={stats.done}
          tone="vermilion"
          extra={`${stats.completionRate}%`}
        />
      </header>

      {error && (
        <p role="alert" className="mb-3 text-xs text-vermilion">
          {error}
        </p>
      )}

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-6 md:grid-cols-[1fr_400px]">
        <div className="flex flex-col overflow-hidden border border-line">
          <div className="flex items-baseline justify-between border-b border-line bg-washi-raised px-4 py-2">
            <h3 className="text-sm font-bold text-ink">
              본인 담당 서비스 · 접수 시작 D-60
            </h3>
            <span className="text-xs text-muted">{services.length}건</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-cream">
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                  <th className="px-3 py-2">날짜</th>
                  <th className="px-3 py-2">전형</th>
                  <th className="px-3 py-2">우선순위</th>
                  <th className="px-3 py-2">업무</th>
                  <th className="px-3 py-2 w-20">상태</th>
                </tr>
              </thead>
              <tbody>
                {services.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-sm text-muted"
                    >
                      앞으로 60일 안에 접수 시작하는 본인 담당 서비스가 없습니다.
                    </td>
                  </tr>
                ) : (
                  services.map((svc) => {
                    const d = dDayFrom(today, svc.write_start_at);
                    const prio = priorityFromDDay(d);
                    const isDone = doneServiceIds.has(svc.id);
                    const isLinked = linkedServiceIds.has(svc.id);
                    return (
                      <tr
                        key={svc.id}
                        draggable={!isDone}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/x-service-id", svc.id);
                          e.dataTransfer.effectAllowed = "copy";
                          setDragging(svc.id);
                        }}
                        onDragEnd={() => setDragging(null)}
                        onDoubleClick={() => !isDone && handleAddService(svc)}
                        className={`border-b border-line-soft transition-colors ${
                          isDone
                            ? "bg-line-soft text-muted line-through"
                            : isLinked
                              ? "bg-cream/60 text-ink"
                              : "text-ink hover:bg-washi-raised"
                        } ${dragging === svc.id ? "opacity-50" : ""} ${
                          isDone ? "cursor-default" : "cursor-grab"
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-xs">
                          {svc.write_start_at}
                          <span className="ml-1 text-muted">
                            (D{d >= 0 ? "-" : "+"}
                            {Math.abs(d)})
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {svc.application_type}
                        </td>
                        <td
                          className={`px-3 py-2 text-xs font-bold ${PRIORITY_TONE[prio]}`}
                        >
                          {PRIORITY_LABEL[prio]}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">
                            {svc.university_name} · {svc.service_name}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {isDone ? (
                            <span className="text-muted">완료</span>
                          ) : isLinked ? (
                            <span className="text-vermilion">담음</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddService(svc)}
                              disabled={isPending && busyService === svc.id}
                              className="border border-line bg-transparent px-2 py-0.5 text-2xs hover:border-vermilion hover:text-vermilion disabled:opacity-50"
                            >
                              + 담기
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside
          onDragOver={(e) => {
            e.preventDefault();
            setDropOver(true);
            e.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={() => setDropOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col overflow-hidden border md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-160px)] ${
            dropOver ? "border-vermilion bg-vermilion/5" : "border-line"
          }`}
        >
          <div className="flex items-baseline justify-between border-b border-line bg-washi-raised px-4 py-2">
            <h3 className="text-sm font-bold text-ink">내 할 일</h3>
            <span className="text-xs text-muted">
              {stats.inProgress}건 진행 / {stats.done}건 완료
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {todos.length === 0 ? (
              <p className="border border-dashed border-line p-6 text-center text-xs text-muted">
                왼쪽 서비스를 끌어 놓거나 “+ 담기” 버튼으로 추가하세요.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {todos.map((t) => (
                  <li
                    key={t.id}
                    className={`flex items-start gap-2 border border-line-soft bg-washi-raised p-2 text-sm ${
                      t.done ? "opacity-60" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      aria-label={t.title}
                      checked={t.done}
                      onChange={(e) => {
                        startTransition(async () => {
                          const r = await onToggleDone(t.id, e.target.checked);
                          if (!r.ok) setError(r.error ?? "토글 실패");
                        });
                      }}
                      className="mt-0.5 size-4 accent-vermilion"
                    />
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          t.done ? "text-muted line-through" : "text-ink"
                        }`}
                      >
                        {t.title}
                      </p>
                      {t.body && (
                        <p className="mt-0.5 whitespace-pre-wrap text-2xs text-muted">
                          {t.body}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2 text-2xs">
                        <span className={PRIORITY_TONE[t.priority]}>
                          {PRIORITY_LABEL[t.priority]}
                        </span>
                        {t.done_at && (
                          <span className="text-muted">
                            {new Date(t.done_at).toLocaleDateString("ko-KR")}{" "}
                            완료
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`${t.title} 삭제`}
                      onClick={() => {
                        startTransition(async () => {
                          const r = await onDeleteTodo(t.id);
                          if (!r.ok) setError(r.error ?? "삭제 실패");
                        });
                      }}
                      className="text-2xs text-muted hover:text-vermilion"
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function StatCircle({
  label,
  value,
  tone,
  extra,
}: {
  label: string;
  value: number;
  tone: "ink" | "muted" | "gold" | "vermilion";
  extra?: string;
}) {
  const ringClass =
    tone === "ink"
      ? "border-ink text-ink"
      : tone === "muted"
        ? "border-line text-muted"
        : tone === "gold"
          ? "border-gold text-gold"
          : "border-vermilion text-vermilion";
  return (
    <div className="flex items-center gap-3 border border-line bg-washi-raised p-3">
      <div
        className={`flex h-12 w-12 items-center justify-center border-2 ${ringClass} text-base font-bold`}
      >
        {value}
      </div>
      <div>
        <p className="text-xs text-muted">{label}</p>
        {extra && <p className="text-sm font-bold text-ink">{extra}</p>}
      </div>
    </div>
  );
}
