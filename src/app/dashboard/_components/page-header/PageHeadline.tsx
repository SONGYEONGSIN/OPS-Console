type Props = {
  title: string;
  accent?: string;
  description?: string;
};

export function PageHeadline({ title, accent, description }: Props) {
  return (
    <div className="space-y-3">
      <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink lg:text-[44px]">
        {accent && (
          <>
            <span>{accent}</span>
            <span aria-hidden className="mx-3 font-medium text-vermilion">—</span>
          </>
        )}
        <span>{title}</span>
      </h1>
      {description && (
        <p className="max-w-[680px] text-sm leading-[1.65] text-ink-soft">
          {description}
        </p>
      )}
    </div>
  );
}
