import type { ReactNode } from "react";

/**
 * 탭 제목 — h2 는 탭 이름만 담고(접근 이름을 탭 이름으로 유지), 건수는 제목 밖에 둔다.
 * children 은 제목 아래 보조 줄(안 붙은 서비스 등).
 */
export function TabHeading(props: {
  title: string;
  summary: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-xl font-bold text-ink">{props.title}</h2>
        <span className="text-sm tabular-nums text-muted">{props.summary}</span>
      </div>
      {props.children}
    </div>
  );
}
