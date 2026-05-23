type Props = {
  title: string;
  titleRight?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/** 사이드바 공통 박스 — title row(좌측 텍스트 + 우측 슬롯) + border-b + children. */
export function SideBox({ title, titleRight, className = "", children }: Props) {
  return (
    <section className={`flex flex-col border border-ink bg-washi-raised p-4 ${className}`}>
      <header className="mb-3 flex items-center justify-between border-b border-ink pb-2">
        <h3 className="text-[13px] font-bold text-ink">{title}</h3>
        {titleRight ?? null}
      </header>
      {children}
    </section>
  );
}
