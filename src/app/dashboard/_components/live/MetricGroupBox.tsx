type Props = {
  title: string;
  columns: 2 | 3;
  children: React.ReactNode;
};

/** 그룹 박스: 섹션 타이틀(앞 vermilion 정사각 dot) + sub grid(2/3열). */
export function MetricGroupBox({ title, columns, children }: Props) {
  const cols = columns === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className="border border-ink bg-cream p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink-soft">
        <span className="inline-block h-1.5 w-1.5 bg-vermilion" />
        {title}
      </h3>
      <div data-subgrid className={`grid gap-2.5 ${cols}`}>
        {children}
      </div>
    </div>
  );
}
