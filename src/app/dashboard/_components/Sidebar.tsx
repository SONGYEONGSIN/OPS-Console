"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SbSection, SbGroup, SbItem } from "../_data";

const WORK_START_KST_HOUR = 9;
const WORK_END_KST_HOUR = 18;

function workProgress(now: Date): number | null {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const total = h * 60 + m;
  const start = WORK_START_KST_HOUR * 60;
  const end = WORK_END_KST_HOUR * 60;
  if (total < start || total > end) return null;
  return (total - start) / (end - start);
}

/**
 * 사이드바 — 데스크탑 고정 240px (1024–1279에서 200px), 1023↓에서 드로어.
 * 그룹은 클릭으로 펼침/접힘. active는 usePathname() 기반.
 * slug 있는 항목은 <Link>, 없는 항목은 div (네비게이션 비활성).
 * "실시간 현황"은 slug 없지만 /dashboard index와 매칭.
 */
export function Sidebar({
  sections,
  open,
  onClose,
  me = null,
}: {
  sections: SbSection[];
  open: boolean;
  onClose: () => void;
  me?: import("@/features/auth/queries").CurrentOperator | null;
}) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const init = new Set<string>();
    sections.forEach((s, si) =>
      s.entries.forEach((e, ei) => {
        if (e.kind === "group" && e.defaultOpen) init.add(`${si}:${ei}`);
      }),
    );
    return init;
  });

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <aside
      id="sidebar"
      role={open ? "dialog" : "navigation"}
      aria-modal={open ? "true" : undefined}
      aria-label="운영부 메뉴"
      className={`dashboard-sidebar overflow-y-auto border-r border-line bg-sidebar py-4 lg:static lg:translate-x-0 max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:bottom-0 max-lg:z-40 max-lg:w-[min(84vw,300px)] max-lg:pt-5 max-lg:transition-transform max-lg:duration-[var(--drawer-ms)] max-lg:ease-[var(--drawer-ease)] max-lg:[box-shadow:var(--shadow-drawer-left)] ${
        open ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
      }`}
    >
      <DrawerCloseButton onClick={onClose} label="메뉴 닫기" />
      <h2 className="sr-only">운영부 메뉴</h2>

      {sections.map((section, si) => (
        <div key={si} className="mb-[22px] px-4">
          <div className="mb-2.5 flex items-center justify-between text-3xs uppercase tracking-[0.22em] text-muted">
            <span className="font-medium tracking-[0.06em]">
              {section.title}
            </span>
            <span className="ml-2.5 h-px flex-1 bg-line-soft" />
          </div>

          {section.entries.map((entry, ei) => {
            if (entry.kind === "item") {
              return (
                <ItemRow
                  key={ei}
                  ico={entry.ico}
                  label={entry.label}
                  count={entry.count}
                  slug={entry.slug}
                  pathname={pathname}
                />
              );
            }
            const groupKey = `${si}:${ei}`;
            return (
              <GroupBlock
                key={groupKey}
                group={entry}
                open={openGroups.has(groupKey)}
                onToggle={() => toggleGroup(groupKey)}
                pathname={pathname}
              />
            );
          })}
        </div>
      ))}

      <SidebarFooter me={me} />
    </aside>
  );
}

/**
 * ItemRow — section.entries 직접 item.
 * - slug 있으면 <Link href={`/dashboard/${slug}`}>
 * - "실시간 현황"은 slug 없지만 pathname === "/dashboard"이면 active
 * - 그 외 slug 없으면 비활성 div
 */
function ItemRow({
  ico,
  label,
  count,
  slug,
  pathname,
}: {
  ico: string;
  label: string;
  count?: string;
  slug?: string;
  pathname: string;
}) {
  const isIndexItem = !slug && label === "실시간 현황";
  const isActive = slug
    ? pathname === `/dashboard/${slug}`
    : isIndexItem && pathname === "/dashboard";
  const href = slug ? `/dashboard/${slug}` : isIndexItem ? "/dashboard" : null;

  const className = `-ml-4 grid w-[calc(100%+1rem)] grid-cols-[18px_1fr_auto] items-center gap-2.5 border-l-2 bg-transparent px-2 py-1.5 pl-[22px] text-left text-md transition-colors ${
    isActive
      ? "border-vermilion bg-washi-raised font-medium text-ink"
      : "border-transparent text-ink-soft hover:bg-sidebar-hover"
  }`;

  const inner = (
    <>
      <span className="text-center text-sm leading-none text-vermilion">
        {ico}
      </span>
      <span>{label}</span>
      <span
        className={`text-2xs tracking-[0.04em] ${isActive ? "font-medium text-vermilion" : "text-muted"}`}
      >
        {count ?? ""}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        prefetch={false}
        aria-current={isActive ? "page" : undefined}
        data-tutorial-slug={slug}
        className={`${className} cursor-pointer`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={`${className} cursor-default`}>{inner}</div>;
}

function GroupBlock({
  group,
  open,
  onToggle,
  pathname,
}: {
  group: SbGroup;
  open: boolean;
  onToggle: () => void;
  pathname: string;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="-ml-4 grid w-[calc(100%+1rem)] cursor-pointer grid-cols-[18px_1fr_auto] items-center gap-2.5 bg-transparent px-2 py-1.5 pl-[22px] text-left text-md font-medium text-ink"
      >
        <span
          className={`text-center text-sm text-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          ▸
        </span>
        <span>{group.label}</span>
        <span className="text-2xs tracking-[0.04em] text-muted">
          {group.count ?? ""}
        </span>
      </button>
      {open && (
        <div className="mb-1 ml-2 mt-0.5 border-l border-dashed border-line-soft">
          {group.items.map((it, ii) => (
            <SubItemRow key={ii} item={it} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubItemRow({ item, pathname }: { item: SbItem; pathname: string }) {
  const isActive = !!item.slug && pathname === `/dashboard/${item.slug}`;
  const href = item.slug ? `/dashboard/${item.slug}` : null;

  const className = `relative grid w-full grid-cols-[10px_1fr_auto] items-center gap-2.5 bg-transparent px-2 py-1.5 pl-[18px] text-left text-xs transition-colors ${
    isActive
      ? "font-medium text-vermilion"
      : "text-ink-soft hover:bg-sidebar-hover"
  }`;

  const inner = (
    <>
      {isActive && (
        <span
          aria-hidden
          className="absolute -left-px top-0 bottom-0 w-0.5 bg-vermilion"
        />
      )}
      <span
        className={`text-center text-2xs leading-none ${isActive ? "text-vermilion" : "text-faint"}`}
      >
        {item.ico}
      </span>
      <span>{item.label}</span>
      <span
        className={`text-2xs tracking-[0.04em] ${isActive ? "font-medium text-vermilion" : "text-muted"}`}
      >
        {item.count ?? ""}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        prefetch={false}
        aria-current={isActive ? "page" : undefined}
        data-tutorial-slug={item.slug}
        className={`${className} cursor-pointer`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={`${className} cursor-default`}>{inner}</div>;
}

function SidebarFooter({
  me,
}: {
  me: import("@/features/auth/queries").CurrentOperator | null;
}) {
  const [progress, setProgress] = useState<number | null>(() =>
    workProgress(new Date()),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setProgress(workProgress(new Date()));
    }, 60_000); // 1분 갱신
    return () => window.clearInterval(id);
  }, []);

  if (!me) return null;
  const displayName = me.displayName || me.email;
  const role = me.role;
  const team = me.team;
  const progressPct =
    progress === null
      ? 0
      : Math.max(0, Math.min(100, Math.round(progress * 100)));
  const workLabel =
    progress === null ? "근무 외 시간" : `근무시간 · 09:00 ~ 18:00 KST`;

  return (
    <div className="mx-4 mt-5 border border-line-soft bg-washi-raised px-3.5 py-3">
      <div className="mb-1.5 flex justify-between text-3xs uppercase tracking-[0.12em] text-muted">
        <span className="tracking-[0.04em] normal-case">현재 사용자</span>
        <strong className="font-medium text-ink">{displayName}</strong>
      </div>
      <div className="mb-2 text-2xs text-muted">
        {role}
        {team && <> · {team}</>}
      </div>
      <div className="relative h-[3px] border border-line-soft bg-sidebar">
        {/* 일회성: 근무시간 진행률 vermilion→gold 그라디언트 (토큰화 가치 낮음) */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 transition-[width] duration-500"
          style={{
            width: `${progressPct}%`,
            background: "linear-gradient(90deg, var(--vermilion), var(--gold))",
          }}
        />
      </div>
      <div className="mt-2 text-2xs text-muted">{workLabel}</div>
    </div>
  );
}

export function DrawerCloseButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="absolute right-3 top-3 z-[2] hidden h-8 w-8 items-center justify-center rounded-full border border-line-soft bg-transparent text-[18px] leading-none text-ink hover:bg-washi-raised max-lg:inline-flex"
    >
      ×
    </button>
  );
}
