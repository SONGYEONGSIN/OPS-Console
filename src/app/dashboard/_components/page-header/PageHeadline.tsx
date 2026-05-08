type Props = {
  title: string;
  accent?: string;
  description?: string;
};

export function PageHeadline({ title, accent, description }: Props) {
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-bold leading-tight text-ink lg:text-[40px]">
        {accent && (
          <>
            <span>{accent}</span>
            <span aria-hidden className="mx-3 text-vermilion">—</span>
          </>
        )}
        <span>{title}</span>
      </h1>
      {description && (
        <p className="max-w-[720px] text-sm leading-relaxed text-ink-soft">
          {description}
        </p>
      )}
    </div>
  );
}
