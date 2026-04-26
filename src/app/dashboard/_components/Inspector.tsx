"use client";

import { useEffect, useState } from "react";
import type {
  InsField as InsFieldData,
  InsValue,
  ServiceRow,
  TimelineRow,
} from "../_data";
import { DrawerCloseButton } from "./Sidebar";

/**
 * 인스펙터 — 데스크탑 우측 고정 300px (1024–1279에서 260px), 1023↓에서 우측 드로어.
 * 모바일(≤767)에서는 섹션 H3 클릭으로 아코디언 토글.
 *
 * 데이터: `service.inspector` (ServiceRow에 임베드). 행 선택이 바뀌면 헤더/필드/타임라인 모두 교체.
 * 현재 SVC-PAY-001만 풍부한 mock, 나머지는 placeholder (Supabase 연결 시 교체).
 *
 * 색상 강조는 데이터의 `tone`/`bold` 메타로만 표현 — 데이터 레이어가 JSX와 결합하지 않음.
 */
export function Inspector({
  service,
  open,
  onClose,
}: {
  service: ServiceRow;
  open: boolean;
  onClose: () => void;
}) {
  const detail = service.inspector;

  return (
    <aside
      id="inspector"
      role={open ? "dialog" : "complementary"}
      aria-modal={open ? "true" : undefined}
      aria-labelledby="inspector-title"
      className={`flex flex-col overflow-y-auto border-l border-line bg-washi-raised max-lg:fixed max-lg:bottom-0 max-lg:right-0 max-lg:top-0 max-lg:z-40 max-lg:w-[min(92vw,360px)] max-lg:transition-transform max-lg:duration-[var(--drawer-ms)] max-lg:ease-[var(--drawer-ease)] max-lg:[box-shadow:var(--shadow-drawer-right)] ${
        open ? "max-lg:translate-x-0" : "max-lg:translate-x-full"
      }`}
    >
      <DrawerCloseButton onClick={onClose} label="인스펙터 닫기" />

      {/* 1) 헤더 */}
      <header className="relative order-0 border-b border-line bg-cream px-5 pb-3.5 pt-4">
        <div className="mb-2 flex justify-between text-3xs uppercase tracking-[0.24em] text-muted">
          <span className="text-2xs tracking-[0.06em] normal-case">
            인스펙터 · 서비스 상세
          </span>
        </div>
        <h2
          id="inspector-title"
          className="mb-2 pr-14 text-[19px] font-semibold leading-[1.3] tracking-[-0.02em]"
        >
          {service.name}
        </h2>
        <div className="text-2xs tracking-[0.06em] text-muted">{detail.ref}</div>
        {/* 우상단 작은 낙관 배지 — 상태에 따라 색/문구 변동 */}
        <SealBadge service={service} />
      </header>

      {/* 2) 모바일에서 sticky actions */}
      <div className="order-[10] mt-auto grid grid-cols-2 gap-2 border-t border-line bg-cream px-5 py-3.5 max-md:order-1 max-md:sticky max-md:top-0 max-md:z-[2] max-md:mt-0 max-md:flex max-md:gap-2 max-md:border-b max-md:border-t-0 max-md:border-line-soft max-md:bg-washi max-md:p-3">
        <InsBtn primary>점검 모드 진입</InsBtn>
        <InsBtn>로그 보기</InsBtn>
        <InsBtn>재시작</InsBtn>
      </div>

      {/* 3) 속성 (모바일 기본 접힘) */}
      <Section
        title="속성"
        rightLink="구성 편집"
        defaultCollapsed
        orderClass="order-[3] max-md:order-[10]"
      >
        {detail.attributes.length > 0 ? (
          detail.attributes.map((f, i) => <Field key={i} field={f} />)
        ) : (
          <EmptyHint>속성 정보가 등록되지 않았습니다.</EmptyHint>
        )}
        {/* 마지막 행: 상태 배지 */}
        <Field
          field={{
            k: "상태",
            v: { text: service.statusLabel, tone: statusTone(service.status) },
          }}
          renderAsBadge
        />
      </Section>

      {/* 4) 실시간 지표 */}
      <Section title="실시간 지표" orderClass="order-[4] max-md:order-[2]">
        {detail.metrics.length > 0 ? (
          detail.metrics.map((f, i) => <Field key={i} field={f} />)
        ) : (
          <EmptyHint>지표 데이터가 아직 없습니다.</EmptyHint>
        )}
      </Section>

      {/* 5) 담당 · 온콜 */}
      <Section title="담당 · 온콜" orderClass="order-[5] max-md:order-[3]">
        {detail.oncall.length > 0 ? (
          detail.oncall.map((f, i) => <Field key={i} field={f} />)
        ) : (
          <EmptyHint>온콜 정보가 등록되지 않았습니다.</EmptyHint>
        )}
      </Section>

      {/* 6) 분류 및 의존 (모바일 기본 접힘) */}
      <Section
        title="분류 및 의존"
        defaultCollapsed
        orderClass="order-[6] max-md:order-[11]"
      >
        <TaxonomyField label="환경" tags={detail.taxonomy.env} />
        <TaxonomyField label="업스트림" tags={detail.taxonomy.upstream} />
        <TaxonomyField label="다운스트림" tags={detail.taxonomy.downstream} />
      </Section>

      {/* 7) 활동 기록 */}
      <Section title="활동 기록" orderClass="order-[7] max-md:order-[4]">
        {detail.timeline.length > 0 ? (
          <Timeline rows={detail.timeline} />
        ) : (
          <EmptyHint>활동 기록이 없습니다.</EmptyHint>
        )}
      </Section>
    </aside>
  );
}

/* ════════════════════════════════════════════════════════════
   Section (mobile-only accordion)
   ════════════════════════════════════════════════════════════ */
function Section({
  title,
  rightLink,
  defaultCollapsed,
  orderClass,
  children,
}: {
  title: string;
  rightLink?: string;
  defaultCollapsed?: boolean;
  orderClass: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(!!defaultCollapsed);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const showBody = !isMobile || !collapsed;

  return (
    <div className={`border-b border-line-soft px-5 py-4 ${orderClass}`}>
      <h3
        onClick={() => isMobile && setCollapsed((c) => !c)}
        onKeyDown={(e) => {
          if (!isMobile) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setCollapsed((c) => !c);
          }
        }}
        role={isMobile ? "button" : undefined}
        tabIndex={isMobile ? 0 : undefined}
        aria-expanded={isMobile ? !collapsed : undefined}
        className="mb-3 flex select-none items-center justify-between text-3xs uppercase tracking-[0.24em] text-muted max-md:cursor-pointer"
      >
        <span className="flex items-center gap-2 text-xs font-medium normal-case tracking-[0.06em]">
          <span
            className={`hidden text-3xs text-muted transition-transform max-md:inline ${
              isMobile && collapsed ? "-rotate-90" : ""
            }`}
          >
            ▼
          </span>
          {title}
        </span>
        {rightLink && (
          <a
            href="#"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium normal-case tracking-normal text-vermilion no-underline"
          >
            {rightLink}
          </a>
        )}
      </h3>
      {showBody && children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Field — InsValue를 tone/bold/suffix 메타에 따라 렌더
   ════════════════════════════════════════════════════════════ */
const TONE_TEXT_CLASS = {
  sage: "text-sage",
  gold: "text-gold",
  vermilion: "text-vermilion",
} as const;

const TONE_BADGE_CLASS = {
  sage: "border-sage bg-sage text-cream",
  gold: "border-gold bg-gold text-cream",
  vermilion: "border-vermilion bg-vermilion text-cream",
} as const;

function statusTone(status: ServiceRow["status"]): keyof typeof TONE_BADGE_CLASS {
  switch (status) {
    case "urgent":
      return "vermilion";
    case "draft":
      return "gold";
    case "review":
    case "approved":
    default:
      return "sage";
  }
}

function Field({
  field,
  renderAsBadge,
}: {
  field: InsFieldData;
  renderAsBadge?: boolean;
}) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-baseline gap-2.5 py-1 text-[12.5px] max-md:grid-cols-[88px_1fr]">
      <div className="text-xs font-medium text-muted">{field.k}</div>
      <div className="text-ink">
        {renderAsBadge ? (
          <BadgeValue value={field.v} />
        ) : (
          <RichValue value={field.v} />
        )}
      </div>
    </div>
  );
}

function RichValue({ value }: { value: InsValue }) {
  if (typeof value === "string") return <>{value}</>;
  const cls = [
    value.tone ? TONE_TEXT_CLASS[value.tone] : "",
    value.bold ? "font-semibold" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <span className={cls}>{value.text}</span>
      {value.suffix && (
        <>
          {" "}
          <span className="text-[11px] text-sage">{value.suffix}</span>
        </>
      )}
    </>
  );
}

function BadgeValue({ value }: { value: InsValue }) {
  const text = typeof value === "string" ? value : value.text;
  const tone = typeof value === "string" ? "sage" : value.tone ?? "sage";
  return (
    <span
      className={`inline-block whitespace-nowrap border px-2.5 py-[3px] pb-1 text-2xs font-medium tracking-[0.02em] ${TONE_BADGE_CLASS[tone]}`}
    >
      {text}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════
   Taxonomy / 활동 기록 / 우상단 낙관 / 액션 버튼
   ════════════════════════════════════════════════════════════ */
function TaxonomyField({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-baseline gap-2.5 py-1 text-[12.5px] max-md:grid-cols-[88px_1fr]">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="text-ink">
        {tags.length === 0 ? (
          <span className="text-faint">—</span>
        ) : (
          tags.map((t) => <Tag key={t}>{t}</Tag>)
        )}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-1 inline-block border border-line-soft bg-washi px-1.5 py-px pb-0.5 text-2xs font-medium">
      {children}
    </span>
  );
}

function Timeline({ rows }: { rows: TimelineRow[] }) {
  return (
    <div className="relative pl-4 before:absolute before:bottom-1 before:left-1 before:top-1 before:w-px before:bg-line-soft before:content-['']">
      {rows.map((r, i) => (
        <div
          key={i}
          className={`relative pb-3 text-[12.5px] leading-[1.5] before:absolute before:-left-4 before:top-[5px] before:h-[9px] before:w-[9px] before:rounded-full before:border-[1.5px] before:border-vermilion before:content-[''] ${
            i === 0 ? "before:bg-vermilion" : "before:bg-washi-raised"
          }`}
        >
          <span className="font-semibold text-ink">{r.who}</span>{" "}
          <span className="text-ink-soft">{r.act}</span>
          <span className="mt-0.5 block text-2xs tracking-[0.04em] text-muted">
            <span className="text-xs tracking-normal">{r.tm}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-faint">{children}</div>;
}

function SealBadge({ service }: { service: ServiceRow }) {
  const tone = statusTone(service.status);
  const label = service.inspector.sealLabel ?? service.statusLabel;
  // urgent("장애") 외에도 status별 색상에 맞춰 낙관 배지를 칠한다.
  return (
    <span
      className={`absolute right-5 top-6 inline-flex h-10 w-10 flex-col items-center justify-center rounded-full text-[14px] font-bold leading-none text-cream [box-shadow:1px_1px_0_var(--vermilion-deep)] ${
        tone === "vermilion" ? "bg-vermilion" : tone === "gold" ? "bg-gold" : "bg-sage"
      }`}
    >
      <span aria-hidden>★</span>
      <span className="mt-0.5 text-[8px] font-medium tracking-[0.05em]">
        {label}
      </span>
    </span>
  );
}

function InsBtn({
  primary,
  children,
}: {
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`cursor-pointer border bg-washi-raised px-3 py-2 text-[12px] font-medium text-ink hover:bg-washi max-md:flex-1 max-md:min-h-[var(--tap-min)] ${
        primary
          ? "col-span-2 border-vermilion-deep bg-vermilion text-cream hover:bg-vermilion-deep"
          : "border-line"
      }`}
    >
      {children}
    </button>
  );
}
