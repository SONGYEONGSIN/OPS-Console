import { ScopeToggle } from "./ScopeToggle";

/**
 * LivePageHeader — 실시간 현황 페이지 전용 헤더.
 * 다른 메뉴 PageHeader 패턴 미사용 (breadcrumb·탭·메타 X).
 * title + ● LIVE 인디케이터 + 전체/내것 토글.
 */
export function LivePageHeader({
  mine,
  title,
}: {
  mine: boolean;
  title: string;
}) {
  return (
    <header className="flex items-center justify-between border-b border-line bg-cream px-6 py-3">
      <div className="flex items-baseline gap-3">
        <h1 className="text-md font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h1>
        <span className="font-mono text-2xs uppercase tracking-[0.18em] text-vermilion">
          ● LIVE
        </span>
      </div>
      <ScopeToggle mine={mine} />
    </header>
  );
}
