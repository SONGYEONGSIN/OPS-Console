import type { ReactNode } from "react";

type Props = {
  title: string;
  /** 뺀 건을 뺀 자동 + 직접 건수 */
  count: number;
  /** 제목 밑줄 — 표는 머리줄이 이미 선을 그어 두 줄이 되므로 끈다(다른 표들처럼 제목 아래 바로 머리줄). */
  underline?: boolean;
  /** 하위 탭이 이미 이름·건수를 보여 줄 때 — 제목 줄을 화면에서 숨긴다(sr-only, 표의 이름은 남는다). */
  headingHidden?: boolean;
  children: ReactNode;
};

/**
 * 묶음 한 칸 — 상자 없이 제목 밑줄로 가른다. 직접 추가는 오른쪽 쓸 것 패널(DirectAddPanel) 한 곳이라
 * 여기에는 줄에 붙은 조작만 남는다.
 */
export function GroupShell({
  title,
  count,
  underline = true,
  headingHidden = false,
  children,
}: Props) {
  return (
    <section className="flex flex-col">
      <div
        className={
          headingHidden
            ? "sr-only"
            : `flex flex-wrap items-baseline gap-x-2 gap-y-1 pb-2 ${underline ? "border-b border-line" : ""}`
        }
      >
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <span className="text-xs tabular-nums text-muted">{`${count}건`}</span>
      </div>
      {headingHidden && underline ? (
        // 숨긴 제목 줄이 긋던 선을 본문 위에 — 표는 머리줄이 선을 그어 끈다(underline=false).
        <div className="border-t border-line">{children}</div>
      ) : (
        children
      )}
    </section>
  );
}
