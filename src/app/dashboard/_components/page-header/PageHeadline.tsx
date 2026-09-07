type Props = {
  title: string;
  accent?: string;
  description?: string;
  /**
   * 제목 오른쪽 액션 — 원본 파일 바로가기 같은 것.
   *
   * 목록 헤더(`ListPattern`)에는 이 자리가 있는데 `PageHeader` 를 직접 쓰는
   * 페이지에는 없었다(2026-09-07 총괄장). 안 주면 아무것도 안 그린다.
   */
  action?: React.ReactNode;
};

export function PageHeadline({ title, accent, description, action }: Props) {
  return (
    <div className="space-y-3">
      <div data-headline-row className="flex items-start justify-between gap-4">
        <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink lg:text-[44px]">
          {accent && (
            <>
              <span>{accent}</span>
              <span aria-hidden className="mx-3 font-medium text-vermilion">
                —
              </span>
            </>
          )}
          <span>{title}</span>
        </h1>
        {/* 제목이 두 줄로 접혀도 버튼은 첫 줄에 붙는다 — items-start 가 그 몫이다. */}
        {action && (
          <div data-headline-action className="flex-none pt-2">
            {action}
          </div>
        )}
      </div>
      {description && (
        <p className="max-w-[680px] text-sm leading-[1.65] text-ink-soft">
          {description}
        </p>
      )}
    </div>
  );
}
