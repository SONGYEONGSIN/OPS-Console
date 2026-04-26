"use client";

import { useState } from "react";
import type { SbSection, SbGroup } from "../_data";

/**
 * 사이드바 — 데스크탑 고정 240px (1024–1279에서 200px), 1023↓에서 드로어.
 * 그룹은 클릭으로 펼침/접힘. 아이템은 단일 active.
 */
export function Sidebar({
  sections,
  open,
  onClose,
}: {
  sections: SbSection[];
  open: boolean;
  onClose: () => void;
}) {
  const [activeKey, setActiveKey] = useState<string>("group:0:0:item:0"); // 초기 active = "전체 서비스"
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const init = new Set<string>();
    sections.forEach((s, si) =>
      s.entries.forEach((e, ei) => {
        if (e.kind === "group" && e.defaultOpen) init.add(`${si}:${ei}`);
      })
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
      className={`overflow-y-auto border-r border-line bg-sidebar py-4 lg:static lg:translate-x-0 max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:bottom-0 max-lg:z-40 max-lg:w-[min(84vw,300px)] max-lg:pt-5 max-lg:transition-transform max-lg:duration-[var(--drawer-ms)] max-lg:ease-[var(--drawer-ease)] max-lg:[box-shadow:var(--shadow-drawer-left)] ${
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
              const key = `s${si}:i${ei}`;
              return (
                <Item
                  key={key}
                  active={activeKey === key}
                  ico={entry.ico}
                  label={entry.label}
                  count={entry.count}
                  onClick={() => setActiveKey(key)}
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
                groupKey={groupKey}
                activeKey={activeKey}
                onItemClick={(itemKey) => setActiveKey(itemKey)}
              />
            );
          })}
        </div>
      ))}

      <SidebarFooter />
    </aside>
  );
}

function Item({
  ico,
  label,
  count,
  active,
  onClick,
}: {
  ico: string;
  label: string;
  count?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`-ml-4 grid w-[calc(100%+1rem)] cursor-pointer grid-cols-[18px_1fr_auto] items-center gap-2.5 border-l-2 bg-transparent px-2 py-1.5 pl-[22px] text-left text-md transition-colors ${
        active
          ? "border-vermilion bg-washi-raised font-medium text-ink"
          : "border-transparent text-ink-soft hover:bg-sidebar-hover"
      }`}
    >
      <span className="text-center text-sm leading-none text-vermilion">
        {ico}
      </span>
      <span>{label}</span>
      <span
        className={`text-2xs tracking-[0.04em] ${active ? "font-medium text-vermilion" : "text-muted"}`}
      >
        {count ?? ""}
      </span>
    </button>
  );
}

function GroupBlock({
  group,
  open,
  onToggle,
  groupKey,
  activeKey,
  onItemClick,
}: {
  group: SbGroup;
  open: boolean;
  onToggle: () => void;
  groupKey: string;
  activeKey: string;
  onItemClick: (itemKey: string) => void;
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
          className={`text-2xs text-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`}
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
          {group.items.map((it, ii) => {
            const itemKey = `group:${groupKey}:item:${ii}`;
            const isActive = activeKey === itemKey;
            return (
              <button
                type="button"
                key={ii}
                onClick={() => onItemClick(itemKey)}
                aria-pressed={isActive}
                className={`grid w-full cursor-pointer grid-cols-[10px_1fr_auto] items-center gap-2.5 bg-transparent px-2 py-1.5 pl-[18px] text-left text-xs transition-colors ${
                  isActive
                    ? "font-medium text-vermilion"
                    : "text-muted hover:bg-sidebar-hover"
                }`}
              >
                <span
                  className={`text-center text-2xs leading-none ${isActive ? "text-vermilion" : "text-faint"}`}
                >
                  {it.ico}
                </span>
                <span>{it.label}</span>
                <span
                  className={`text-2xs tracking-[0.04em] ${isActive ? "font-medium text-vermilion" : "text-muted"}`}
                >
                  {it.count ?? ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="mx-4 mt-5 border border-line-soft bg-washi-raised px-3.5 py-3">
      <div className="mb-1.5 flex justify-between text-3xs uppercase tracking-[0.12em] text-muted">
        <span className="tracking-[0.04em] normal-case">현재 근무</span>
        <strong className="font-medium text-ink">송영석 · 1차</strong>
      </div>
      <div className="relative h-[3px] border border-line-soft bg-sidebar">
        {/* 일회성: 시프트 사용량 vermilion→gold 그라디언트 (토큰화 가치 낮음) */}
        <span
          className="absolute inset-y-0 left-0 w-[62%]"
          style={{
            background: "linear-gradient(90deg, var(--vermilion), var(--gold))",
          }}
        />
      </div>
      <div className="mt-2 text-2xs text-muted">2교대 · 14:00 ~ 22:00 KST</div>
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
