"use client";

import { useState, useCallback, type ReactNode } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export type GuideItem = {
  title: string;
  detail?: string;
  /** 외부 자료 링크 — 있으면 title이 새 탭 링크로 렌더 (자료실 탭에서 활용) */
  url?: string;
};

export type GuideSection = {
  ico: string;
  title: string;
  description?: string;
  items: GuideItem[];
};

export type GuideTab = {
  value: string;
  label: string;
  /** 정적 가이드 콘텐츠 — 카드 그룹 자동 렌더 */
  sections?: GuideSection[];
  /** 임의 콘텐츠 (예: 회차 관리 ListPattern 임베드) */
  children?: ReactNode;
  /** sections/children 미설정 시 안내문 */
  placeholder?: string;
};

type Props = {
  title: string;
  header?: ReactNode;
  tabs: GuideTab[];
  /** URL 쿼리 미설정 시 기본 탭. 미지정 시 첫 번째 탭. */
  defaultTab?: string;
};

/**
 * GuidePattern — 가이드형 메뉴(onboarding / manual / sop / faq)에 재사용할 새 패턴.
 * - 탭 시스템 (URL 쿼리 ?tab=<value>로 상태 보존)
 * - 카드 그룹 슬롯 (정적 콘텐츠) 또는 임의 children
 * - PageHeader 슬롯
 *
 * mockup 영감: 탭 + 단계별 카드 그룹 + 번호 매겨진 항목.
 * OPS-Console 톤(washi/cream)과 vermilion accent 유지 — 다크 컬러는 무시.
 */
export function GuidePattern({ title, header, tabs, defaultTab }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialTab = (() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && tabs.some((t) => t.value === urlTab)) return urlTab;
    return defaultTab ?? tabs[0]?.value ?? "";
  })();

  const [active, setActive] = useState(initialTab);

  const onTabClick = useCallback(
    (value: string) => {
      setActive(value);
      const next = new URLSearchParams(searchParams.toString());
      next.set("tab", value);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const activeTab = tabs.find((t) => t.value === active) ?? tabs[0];

  return (
    <>
      {header}

      <section className="p-7">
        <header className="mb-4 flex items-baseline gap-2">
          <h2 className="text-xl font-bold text-ink">{title}</h2>
        </header>

        <div
          role="tablist"
          aria-label={`${title} 탭`}
          className="mb-4 flex flex-wrap gap-1 border-b border-line"
        >
          {tabs.map((tab) => {
            const isActive = tab.value === active;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabClick(tab.value)}
                className={`relative cursor-pointer border-none bg-transparent px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "font-bold text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div role="tabpanel">
          {activeTab?.sections && activeTab.sections.length > 0 ? (
            <div className="space-y-6">
              {activeTab.sections.map((section) => (
                <article
                  key={section.title}
                  className="border border-line-soft bg-situation-bg p-5"
                >
                  <header className="mb-3 flex items-baseline gap-2">
                    <span
                      aria-hidden
                      className="text-base text-vermilion"
                    >
                      {section.ico}
                    </span>
                    <h3 className="text-base font-bold text-ink">
                      {section.title}
                    </h3>
                  </header>
                  {section.description && (
                    <p className="mb-3 text-sm text-muted">
                      {section.description}
                    </p>
                  )}
                  <ol className="space-y-2">
                    {section.items.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 border-l border-line-soft pl-3"
                      >
                        <span
                          aria-hidden
                          className="mt-0.5 inline-block min-w-5 border border-line-soft bg-cream px-1 text-center text-xs text-muted"
                        >
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-ink underline-offset-2 hover:text-vermilion hover:underline"
                            >
                              {item.title}
                              <span aria-hidden className="ml-1 text-muted">↗</span>
                            </a>
                          ) : (
                            <p className="text-sm font-medium text-ink">
                              {item.title}
                            </p>
                          )}
                          {item.detail && (
                            <p className="mt-0.5 text-xs text-muted">
                              {item.detail}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          ) : activeTab?.children ? (
            <div>{activeTab.children}</div>
          ) : (
            <p className="border border-dashed border-line-soft bg-washi-raised p-8 text-center text-sm text-muted">
              {activeTab?.placeholder ?? "준비 중"}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
