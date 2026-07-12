"use client";

import { useState } from "react";
import type { ServiceRow, ServiceStatus, IcoTone } from "../_data";

const TABS = ["실시간 대시보드", "배치 진행 #2471", "주간 점검 내역"];
const CHIPS = ["전체", "장애 · 주의", "내 담당", "PROD"];
const VIEWS = [
  { id: "list", label: "☰ 목록" },
  { id: "card", label: "▦ 카드" },
  { id: "topo", label: "◫ 토폴로지" },
];

export function Content({
  services,
  selectedId,
  onSelectRow,
  onInspectorToggle,
  inspectorOpen,
}: {
  services: ServiceRow[];
  selectedId: string;
  onSelectRow: (id: string) => void;
  onInspectorToggle: () => void;
  inspectorOpen: boolean;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [activeChip, setActiveChip] = useState(0);
  const [activeView, setActiveView] = useState("list");

  return (
    <main className="flex flex-col overflow-y-auto bg-cream max-md:overflow-visible max-md:pb-[28px]">
      {/* ── Crumb + Tabs ── */}
      <div className="flex items-center justify-between border-b border-line-soft bg-sidebar px-7 pt-2.5 text-[12px] text-muted max-md:flex-col max-md:items-stretch max-md:p-0">
        <div className="flex items-center gap-1.5 py-1.5 max-md:px-3 max-md:text-xs">
          <a className="cursor-pointer text-muted hover:text-ink">개요</a>
          <span className="text-faint">/</span>
          <a className="cursor-pointer text-muted hover:text-ink">서비스 그룹</a>
          <span className="text-faint">/</span>
          <strong className="font-medium text-ink">전체 서비스 · 2교대</strong>
        </div>
        <div className="flex items-end gap-0 max-md:gap-2 max-md:overflow-x-auto max-md:px-3">
          {TABS.map((label, i) => {
            const isActive = activeTab === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`relative -mb-px cursor-pointer border border-transparent border-b-0 px-4 py-1.5 text-[12px] font-medium max-md:max-w-[160px] max-md:flex-shrink-0 max-md:text-sm ${
                  isActive
                    ? "border-line-soft bg-cream text-ink before:absolute before:left-0 before:right-0 before:top-0 before:h-0.5 before:bg-vermilion before:content-['']"
                    : "text-muted hover:text-ink"
                }`}
              >
                {label}
                <span className="ml-2 inline-block h-3.5 w-3.5 text-center text-[11px] leading-[14px] opacity-40 group-hover:opacity-100">
                  ×
                </span>
              </button>
            );
          })}
          <span className="cursor-pointer px-4 py-1.5 text-[12px] font-medium text-faint max-md:sticky max-md:right-0 max-md:bg-washi">
            +
          </span>
        </div>
      </div>

      {/* ── Content Header ── */}
      <header className="px-9 pb-4 pt-6 max-md:px-3 max-md:pt-4">
        <div className="mb-2.5 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-muted">
          <span className="text-[12px] tracking-[0.1em] text-vermilion">
            근무 II · 2026-04-24
          </span>
          <span>·</span>
          <span className="text-[11px] normal-case tracking-[0.02em]">서비스 12개</span>
          <span>·</span>
          <span className="text-[11px] normal-case tracking-[0.02em]">자동 새로고침 10초</span>
        </div>
        <h1 className="mb-2 text-[44px] font-semibold leading-[1.15] tracking-[-0.03em] max-md:text-[32px]">
          실시간{" "}
          <em className="not-italic font-medium text-vermilion">—</em> 서비스
          운영
        </h1>
        <p className="max-w-[680px] text-[14px] leading-[1.65] text-ink-soft">
          현재 운영 중인 서비스 목록입니다. 각 서비스의 상태·담당 팀·최근
          이벤트를 확인하고, 선택 시 인스펙터에서 실시간 지표를 볼 수 있습니다.
          주의 상태는 주홍색 낙관으로 표시됩니다.
        </p>
      </header>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 px-9 pb-4 max-md:flex-wrap max-md:gap-2 max-md:px-3">
        <div className="flex flex-wrap items-center gap-2.5 max-md:w-full max-md:gap-2">
          <ToolBtn primary>＋ 장애 등록</ToolBtn>
          <ToolBtn>↻ 새로고침</ToolBtn>
          <ToolBtn>⇣ 일일 보고서</ToolBtn>
          <ToolBtn>⚏ 필터</ToolBtn>
          <div className="flex gap-1.5 max-md:overflow-x-auto max-md:[&::-webkit-scrollbar]:hidden">
            {CHIPS.map((c, i) => {
              const on = activeChip === i;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveChip(i)}
                  className={`cursor-pointer border px-2.5 py-1 text-[11px] font-medium ${
                    on
                      ? "border-ink bg-ink text-cream"
                      : "border-line-soft text-muted hover:border-line hover:text-ink"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
          {/* 태블릿(≤1023) — 인스펙터 토글. selectedId는 항상 존재(초기값 SVC-PAY-001)이므로 disabled 가드 불필요. */}
          <button
            type="button"
            aria-expanded={inspectorOpen}
            aria-controls="inspector"
            onClick={onInspectorToggle}
            className={`hidden cursor-pointer items-center gap-1 border border-line-soft bg-transparent px-3 text-sm text-ink min-h-[var(--tap-min)] max-lg:inline-flex md:max-lg:inline-flex max-md:hidden ${
              inspectorOpen ? "bg-washi-raised" : ""
            }`}
          >
            상세 ▸
          </button>
        </div>
        <div className="flex border border-line-soft max-md:w-full max-md:justify-end">
          {VIEWS.map((v, i) => {
            const on = activeView === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveView(v.id)}
                className={`cursor-pointer border-none bg-transparent px-2.5 py-1.5 text-[12px] ${
                  i < VIEWS.length - 1 ? "border-r border-line-soft" : ""
                } ${on ? "bg-ink text-cream" : "text-muted"}`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Doc list ── */}
      <DocList
        services={services}
        selectedId={selectedId}
        onSelect={onSelectRow}
      />
    </main>
  );
}

function ToolBtn({
  children,
  primary,
}: {
  children: React.ReactNode;
  primary?: boolean;
}) {
  const base =
    "inline-flex items-center gap-[7px] cursor-pointer border px-3 py-1.5 text-[12px] font-medium";
  return (
    <button
      type="button"
      className={
        primary
          ? `${base} border-vermilion-deep bg-vermilion text-cream hover:bg-vermilion-deep`
          : `${base} border-line-soft bg-washi-raised text-ink hover:border-line hover:bg-washi`
      }
    >
      {children}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════
   Doc list — 데스크탑 6열 그리드, 모바일 카드 형태
   ════════════════════════════════════════════════════════════ */
const ICO_TONE_CLASS: Record<IcoTone, string> = {
  vm: "text-vermilion",
  ig: "text-indigo",
  gd: "text-gold",
  sg: "text-sage",
};

const STATUS_CLASS: Record<ServiceStatus, string> = {
  urgent: "bg-vermilion text-cream border-vermilion",
  draft: "bg-gold text-cream border-gold",
  review: "bg-indigo text-cream border-indigo",
  approved: "bg-sage text-cream border-sage",
};

/**
 * 모바일(≤767) 좌측 띠 색상.
 * 반드시 **리터럴 전체 클래스**를 보관해야 한다 — Tailwind v4 JIT는 소스에서 리터럴 클래스명만
 * 추출하므로 `max-md:${stripe}` 같은 보간된 문자열은 빌드 시 누락된다.
 */
const STATUS_STRIPE_MOBILE: Record<ServiceStatus, string> = {
  urgent: "max-md:before:bg-vermilion",
  draft: "max-md:before:bg-gold",
  review: "max-md:before:bg-transparent",
  approved: "max-md:before:bg-transparent",
};

function DocList({
  services,
  selectedId,
  onSelect,
}: {
  services: ServiceRow[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="px-9 pb-9 max-md:px-0 max-md:pb-0">
      <div className="grid grid-cols-[30px_2fr_110px_120px_100px_80px] gap-3.5 border-y border-line py-2.5 text-2xs uppercase tracking-[0.16em] text-muted max-[1279px]:grid-cols-[26px_2fr_100px_100px_80px] max-[1279px]:[&>*:nth-child(5)]:hidden max-lg:grid-cols-[26px_2fr_110px_90px] max-lg:[&>*:nth-child(5)]:hidden max-lg:[&>*:nth-child(6)]:hidden max-md:hidden">
        <div>#</div>
        <div className="text-[11px] font-medium normal-case tracking-[0.08em]">
          서비스
        </div>
        <div className="text-[11px] font-medium normal-case tracking-[0.08em]">
          상태
        </div>
        <div className="text-[11px] font-medium normal-case tracking-[0.08em]">
          담당 팀
        </div>
        <div className="text-[11px] font-medium normal-case tracking-[0.08em]">
          최근 이벤트
        </div>
        <div className="text-[11px] font-medium normal-case tracking-[0.08em]">
          분류
        </div>
      </div>

      {services.map((svc) => (
        <DocRow
          key={svc.id}
          svc={svc}
          selected={selectedId === svc.id}
          onClick={() => onSelect(svc.id)}
        />
      ))}
    </div>
  );
}

function DocRow({
  svc,
  selected,
  onClick,
}: {
  svc: ServiceRow;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative grid w-full cursor-pointer grid-cols-[30px_2fr_110px_120px_100px_80px] items-center gap-3.5 border-b border-dashed border-line-soft bg-transparent py-3 text-left transition-colors hover:bg-line-soft max-[1279px]:grid-cols-[26px_2fr_100px_100px_80px] max-[1279px]:[&>*:nth-child(5)]:hidden max-lg:grid-cols-[26px_2fr_110px_90px] max-lg:[&>*:nth-child(5)]:hidden max-lg:[&>*:nth-child(6)]:hidden max-md:block max-md:min-h-16 max-md:border-line-soft max-md:py-3 max-md:pl-[calc(40px+var(--space-3)*2)] max-md:pr-3 max-md:before:absolute max-md:before:bottom-2 max-md:before:left-0 max-md:before:top-2 max-md:before:w-[3px] max-md:before:content-[''] ${STATUS_STRIPE_MOBILE[svc.status]} ${
        selected
          ? "bg-vermilion/10 before:absolute before:-left-9 before:-right-9 before:bottom-0 before:top-0 before:border-y before:border-vermilion before:content-[''] max-md:bg-vermilion/10 max-md:before:left-0 max-md:before:right-auto"
          : ""
      }`}
    >
      <div
        className={`text-center text-[22px] leading-none max-md:absolute max-md:left-3 max-md:top-1/2 max-md:flex max-md:h-8 max-md:w-8 max-md:-translate-y-1/2 max-md:items-center max-md:justify-center max-md:text-sm ${ICO_TONE_CLASS[svc.icoTone]}`}
      >
        {svc.ico}
      </div>
      <div className="text-[14px] font-medium leading-[1.4] tracking-[-0.015em] max-md:mb-0.5 max-md:block max-md:overflow-hidden max-md:text-ellipsis max-md:whitespace-nowrap max-md:pr-[60px] max-md:text-md max-md:font-semibold">
        {svc.name}
        <small className="mt-0.5 block text-2xs font-normal tracking-[0.06em] text-muted max-md:hidden">
          {svc.sub}
        </small>
      </div>
      <div className="max-md:absolute max-md:right-3 max-md:top-3">
        <span
          className={`inline-block whitespace-nowrap border bg-washi px-2.5 py-[3px] pb-1 text-2xs font-medium tracking-[0.02em] ${STATUS_CLASS[svc.status]}`}
        >
          {svc.statusLabel}
        </span>
      </div>
      <div className="text-[11px] tracking-[0.02em] text-muted max-md:inline max-md:text-xs after:max-md:text-faint after:max-md:content-['_·_']">
        <span className="text-[12px]">{svc.team}</span>
      </div>
      <div className="text-[11px] tracking-[0.02em] text-muted max-md:inline max-md:text-xs after:max-md:text-faint after:max-md:content-['_·_']">
        <span className="text-[12px]">{svc.lastEvent}</span>
      </div>
      <div className="text-2xs tracking-[0.04em] text-muted max-md:inline max-md:text-xs before:max-md:text-faint before:max-md:content-['_·_']">
        <span className="text-vermilion">#</span>
        <span className="text-xs">{svc.tag}</span>
      </div>
    </button>
  );
}
