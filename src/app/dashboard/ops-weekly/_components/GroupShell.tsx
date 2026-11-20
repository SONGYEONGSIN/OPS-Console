import type { ReactNode } from "react";

type Props = {
  title: string;
  /** 뺀 건을 뺀 자동 + 직접 건수 */
  count: number;
  children: ReactNode;
};

/**
 * 묶음 한 칸 — 상자 없이 제목 밑줄로 가른다. 직접 추가는 오른쪽 쓸 것 패널(DirectAddPanel) 한 곳이라
 * 여기에는 줄에 붙은 조작만 남는다.
 */
export function GroupShell({ title, count, children }: Props) {
  return (
    <section className="flex flex-col">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-line pb-2">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <span className="text-xs tabular-nums text-muted">{`${count}건`}</span>
      </div>
      {children}
    </section>
  );
}
