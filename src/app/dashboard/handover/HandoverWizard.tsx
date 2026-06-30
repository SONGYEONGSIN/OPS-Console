"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHandoverProgress } from "@/features/handover/progress-actions";
import { sendHandoverMail } from "@/features/handover/mail-actions";
import {
  HANDOVER_CATEGORIES,
  type HandoverFieldKey,
} from "@/features/handover/categories";
import { isHandoverFieldComplete } from "@/features/handover/completion";
import type { ReadyService } from "@/features/handover/progress-queries";

type Operator = {
  email: string;
  name: string;
  team?: string | null;
  role?: string | null;
};
type Props = {
  services: ReadyService[];
  /** 전체 목록 (페이지네이션 전). selectedService 조회용. 미지정 시 services로 fallback. */
  allServices?: ReadyService[];
  operators: Operator[];
  /** 인계자 — 현재 로그인 사용자 (step3 표시 + 발송 from). */
  from: { name: string; email: string };
  /** Step1 헤더 카운트 바로 옆에 인라인 노출 (예: ScopeChips). */
  step1HeaderRight?: React.ReactNode;
  /** Step1 테이블 하단 슬롯 (예: ListPagination). */
  step1Footer?: React.ReactNode;
};

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = [
  "◇ 서비스 선택",
  "◎ 인수자 선택",
  "✓ 최종 확인",
  "◈ 인수인계 완료",
];

function formatDate(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function HandoverWizard({
  services,
  allServices,
  operators,
  from,
  step1HeaderRight,
  step1Footer,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [serviceId, setServiceId] = useState<string>("");
  const [to, setTo] = useState<Operator | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mailWarning, setMailWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // allServices가 있으면 전체 목록에서 조회 (페이지네이션 후 services에 없어도 찾음)
  const selectedService = (allServices ?? services).find(
    (s) => s.id === serviceId,
  );

  function handleConfirm() {
    if (!serviceId || !to) return;
    setError(null);
    setMailWarning(null);
    startTransition(async () => {
      const r = await createHandoverProgress({
        service_id: serviceId,
        to_email: to.email,
        to_name: to.name,
        notes: notes.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      // 진행 행 생성 OK — 메일 발송 시도 (실패해도 진행 자체는 살아남게 step4로)
      const mail = await sendHandoverMail(r.row.id);
      if (!mail.ok) {
        setMailWarning(`메일 발송 실패: ${mail.error}`);
      }
      setStep(4);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-280px)] flex-col p-7">
      {/* 처리 중 — 화면 중앙 로딩 스피너 오버레이 */}
      {isPending && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-ink/35"
          role="status"
          aria-live="polite"
          aria-label="처리 중"
        >
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-cream/30 border-t-cream" />
          <span className="text-sm text-cream">처리 중…</span>
        </div>
      )}
      <ProgressBar step={step} />
      <div className="mt-8 flex-1">
        {step === 1 && (
          <Step1
            services={services}
            serviceId={serviceId}
            onSelect={setServiceId}
            headerRight={step1HeaderRight}
            footer={step1Footer}
          />
        )}
        {step === 2 && <Step2 operators={operators} to={to} onSelect={setTo} />}
        {step === 3 && selectedService && to && (
          <Step3
            service={selectedService}
            from={from}
            to={to}
            notes={notes}
            onNotesChange={setNotes}
            error={error}
          />
        )}
        {step === 4 && selectedService && to && (
          <Step4
            service={selectedService}
            to={to}
            mailWarning={mailWarning}
            onRestart={() => {
              setStep(1);
              setServiceId("");
              setTo(null);
              setNotes("");
              setMailWarning(null);
            }}
          />
        )}
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <div>
          {step > 1 && step < 4 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="cursor-pointer border border-line bg-cream px-5 py-2 text-sm tracking-[0.04em] text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
            >
              ← 이전
            </button>
          )}
        </div>
        <div>
          {step === 1 && (
            <button
              type="button"
              disabled={!serviceId}
              onClick={() => setStep(2)}
              className="cursor-pointer border border-line bg-cream px-5 py-2 text-sm tracking-[0.04em] text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              다음 →
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              disabled={!to}
              onClick={() => setStep(3)}
              className="cursor-pointer border border-line bg-cream px-5 py-2 text-sm tracking-[0.04em] text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              다음 →
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleConfirm}
              className="cursor-pointer border border-line bg-cream px-5 py-2 text-sm tracking-[0.04em] text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "처리 중..." : "인계 시작"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── ProgressBar ──────────────────────────── */

// 화살표(쉐브론) 모양 — 오른쪽 뾰족 + (첫 단계 외) 왼쪽 노치로 맞물림.
const CHEV =
  "[clip-path:polygon(0_0,calc(100%_-_16px)_0,100%_50%,calc(100%_-_16px)_100%,0_100%,16px_50%)]";
const CHEV_FIRST =
  "[clip-path:polygon(0_0,calc(100%_-_16px)_0,100%_50%,calc(100%_-_16px)_100%,0_100%)]";
// 마지막 단계 — 왼쪽 노치로 맞물리되 오른쪽은 화살표 없이 평평(흐름의 끝).
const CHEV_LAST = "[clip-path:polygon(0_0,100%_0,100%_100%,0_100%,16px_50%)]";
// clip-path는 테두리를 잘라 화살표 외곽선이 사라지므로, drop-shadow 4방향으로
// 잘린 모양을 따라가는 1px 외곽선을 그린다(비활성 단계도 화살표로 보이게).
const CHEV_OUTLINE =
  "[filter:drop-shadow(1px_0_0_var(--line))_drop-shadow(-1px_0_0_var(--line))_drop-shadow(0_1px_0_var(--line))_drop-shadow(0_-1px_0_var(--line))]";

function ProgressBar({ step }: { step: Step }) {
  return (
    <ol className="flex items-stretch text-sm">
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const active = n === step;
        const first = i === 0;
        const last = i === STEP_LABELS.length - 1;
        // 비활성 단계는 진한 washi로 채워 블록이 또렷하게(페이지보다 진하게).
        const tone = active
          ? "bg-vermilion text-cream font-bold"
          : done
            ? `bg-washi text-ink ${CHEV_OUTLINE}`
            : `bg-washi text-muted ${CHEV_OUTLINE}`;
        const clip = first
          ? CHEV_FIRST
          : last
            ? `${CHEV_LAST} -ml-[14px]`
            : `${CHEV} -ml-[14px]`;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={`flex flex-1 items-center justify-center whitespace-nowrap py-3 px-6 ${tone} ${clip}`}
          >
            {label}
          </li>
        );
      })}
    </ol>
  );
}

/* ──────────────────────────── Step1: 서비스 선택 ─────────────────────── */

function Step1({
  services,
  serviceId,
  onSelect,
  headerRight,
  footer,
}: {
  services: ReadyService[];
  serviceId: string;
  onSelect: (id: string) => void;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline gap-3">
        <h3 className="text-xl font-bold text-ink">1 · 서비스 선택</h3>
        <span className="text-sm text-vermilion">{services.length}건</span>
        {headerRight}
        <span className="text-xs text-muted">
          · 인수인계 내용 작성이 완료된(작성완료) 서비스만 표시
        </span>
      </header>
      {services.length === 0 ? (
        <p className="border border-line bg-cream p-6 text-center text-sm text-muted">
          작성완료된 서비스가 없습니다. 먼저 인수인계 내용 탭에서 작성을
          완료하세요.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                <th className="w-10 px-3 py-2"></th>
                <th className="px-3 py-2">대학명 · 서비스</th>
                <th className="px-3 py-2">운영자</th>
                <th className="px-3 py-2">접수구분</th>
                <th className="px-3 py-2">작성일</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => {
                const selected = serviceId === s.id;
                return (
                  <tr
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${selected ? "bg-washi-raised" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="radio"
                        name="service"
                        value={s.id}
                        checked={selected}
                        onChange={() => onSelect(s.id)}
                        aria-label={`${s.university_name} ${s.service_name}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-ink">
                        {s.university_name}
                      </span>
                      <span className="ml-1 text-xs text-muted">
                        · {s.service_name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-soft">
                      {s.operator_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-soft">
                      {s.application_type}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-soft">
                      {formatDate(s.updated_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {footer ?? null}
    </section>
  );
}

/* ──────────────────────────── Step2: 인수자 선택 ─────────────────────── */

function Step2({
  operators,
  to,
  onSelect,
}: {
  operators: Operator[];
  to: Operator | null;
  onSelect: (op: Operator) => void;
}) {
  return (
    <section className="space-y-4">
      <header className="flex items-baseline gap-3">
        <h3 className="text-xl font-bold text-ink">2 · 인수자 선택</h3>
        <span className="text-sm text-vermilion">{operators.length}명</span>
        <span className="text-xs text-muted">· 본인 외 active 운영자</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
              <th className="w-12 px-3 py-2"></th>
              <th className="w-1/5 px-3 py-2">팀</th>
              <th className="w-1/4 px-3 py-2">이름</th>
              <th className="w-1/5 px-3 py-2">역할</th>
              <th className="px-3 py-2">이메일</th>
            </tr>
          </thead>
          <tbody>
            {operators.map((o) => {
              const selected = to?.email === o.email;
              return (
                <tr
                  key={o.email}
                  onClick={() => onSelect(o)}
                  className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${selected ? "bg-washi-raised" : ""}`}
                >
                  <td className="w-12 px-3 py-2">
                    <input
                      type="radio"
                      name="to"
                      value={o.email}
                      checked={selected}
                      onChange={() => onSelect(o)}
                      aria-label={o.name}
                    />
                  </td>
                  <td className="w-1/5 px-3 py-2 text-xs text-ink-soft">
                    {o.team ?? "-"}
                  </td>
                  <td className="w-1/4 px-3 py-2 font-medium text-ink">
                    {o.name}
                  </td>
                  <td className="w-1/5 px-3 py-2 text-xs text-ink-soft">
                    {o.role ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-soft">{o.email}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ──────────────────────────── Step3: 최종 확인 ──────────────────────── */

function Step3({
  service,
  from,
  to,
  notes,
  onNotesChange,
  error,
}: {
  service: ReadyService;
  from: { name: string; email: string };
  to: Operator;
  notes: string;
  onNotesChange: (v: string) => void;
  error: string | null;
}) {
  return (
    <section className="space-y-6">
      <header className="flex items-baseline gap-3">
        <h3 className="text-xl font-bold text-ink">3 · 최종 확인</h3>
        <span className="text-xs text-muted">
          · 이메일 발송 전 인계내용 및 메모를 점검하세요.
        </span>
      </header>

      <dl className="grid grid-cols-[120px_1fr] gap-y-3 border border-line bg-cream p-4 text-sm">
        <dt className="text-muted">서비스</dt>
        <dd className="text-ink">
          {service.application_type ? (
            <span className="mr-1 text-xs text-muted">
              {service.application_type}
            </span>
          ) : null}
          <span className="font-medium">{service.university_name}</span>
          <span className="ml-1 text-xs text-muted">
            · {service.service_name}
          </span>
        </dd>
        <dt className="text-muted">인계자</dt>
        <dd className="text-ink">
          <span className="font-medium">{from.name}</span>
          <span className="ml-1 text-xs text-muted">· {from.email}</span>
        </dd>
        <dt className="text-muted">인수자</dt>
        <dd className="text-ink">
          <span className="font-medium">{to.name}</span>
          <span className="ml-1 text-xs text-muted">· {to.email}</span>
        </dd>
      </dl>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-ink">인수인계 내용</h4>
        <div className="border border-line">
          {HANDOVER_CATEGORIES.map((cat) => (
            <CategoryAccordion key={cat.key} category={cat} service={service} />
          ))}
        </div>
      </div>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">메모 (선택)</span>
        <textarea
          aria-label="메모"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="인계 시 참고할 메모"
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>

      {error && <p className="text-sm text-vermilion">{error}</p>}
    </section>
  );
}

function CategoryAccordion({
  category,
  service,
}: {
  category: (typeof HANDOVER_CATEGORIES)[number];
  service: ReadyService;
}) {
  const [open, setOpen] = useState(false);
  // 구조화 필드(계약정보/정산/컨텍/체크리스트)는 *_md가 아닌 구조화 데이터로 판정.
  const filled = category.fields.filter((f) =>
    isHandoverFieldComplete(service, f.key),
  ).length;
  return (
    <div className="border-b border-line-soft last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between bg-transparent px-4 py-3 text-left hover:bg-washi-raised"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden className="text-xs text-muted">
            {open ? "▼" : "▶"}
          </span>
          <span className="text-sm font-medium text-ink">{category.label}</span>
          <span className="text-xs text-muted">
            {filled}/{category.fields.length}
          </span>
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line-soft bg-cream px-4 py-3">
          {category.fields.map((f) => (
            <div key={f.key}>
              <div className="text-xs text-muted">{f.label}</div>
              <FieldBody service={service} fieldKey={f.key} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** step3 미리보기 — 필드별 본문. 구조화 필드는 JSON 데이터로 렌더. */
function FieldBody({
  service,
  fieldKey,
}: {
  service: ReadyService;
  fieldKey: HandoverFieldKey;
}) {
  if (!isHandoverFieldComplete(service, fieldKey)) {
    return <p className="mt-1 text-xs italic text-muted">(미작성)</p>;
  }

  const labeled = (rows: [string, string | null | undefined][]) => (
    <div className="mt-1 space-y-0.5 text-xs text-ink">
      {rows
        .filter(([, v]) => v && String(v).trim())
        .map(([k, v]) => (
          <div key={k}>
            <span className="text-muted">{k}: </span>
            {v}
          </div>
        ))}
    </div>
  );
  const memoBlock = (memo: string | null | undefined) =>
    memo && memo.trim() ? (
      <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-xs text-ink">
        {memo}
      </pre>
    ) : null;

  if (fieldKey === "contract_info_md") {
    const c = service.contract_info;
    return labeled([
      ["제목", c?.title],
      ["형태", c?.type],
      ["진행", c?.progress],
      ["상태", c?.status],
      ["메모", c?.memo],
    ]);
  }
  if (fieldKey === "contract_data_md" || fieldKey === "docs_md") {
    const isDocs = fieldKey === "docs_md";
    const checklist = isDocs
      ? service.docs_checklist
      : service.contract_data_checklist;
    const memo = isDocs ? service.docs_md : service.contract_data_md;
    return (
      <div className="mt-1 space-y-1 text-xs text-ink">
        {checklist
          .filter((c) => c.text.trim())
          .map((c) => (
            <div key={c.id}>
              <span aria-hidden className="text-muted">
                {c.done ? "☑ " : "☐ "}
              </span>
              {c.text}
            </div>
          ))}
        {memoBlock(memo)}
      </div>
    );
  }
  if (fieldKey === "payment_fee_md") {
    const p = service.payment_fee;
    return (
      <>
        {labeled([
          ["정산기한", p?.deadline],
          ["담당자", p?.manager],
        ])}
        {memoBlock(p?.memo)}
      </>
    );
  }
  if (fieldKey === "payment_invoice_md") {
    const p = service.payment_invoice;
    return (
      <>
        {labeled([["발행유형", p?.issueType]])}
        {memoBlock(p?.memo)}
      </>
    );
  }
  if (fieldKey === "school_contact_md") {
    return (
      <ul className="mt-1 space-y-0.5 text-xs text-ink">
        {service.school_contacts.map((c) => (
          <li key={c.id}>
            <span className="font-medium">
              {c.name}
              {c.jobTitle ? ` (${c.jobTitle})` : ""}
            </span>
            {c.ext ? <span className="text-muted"> · {c.ext}</span> : null}
            {c.email ? <span className="text-muted"> · {c.email}</span> : null}
          </li>
        ))}
      </ul>
    );
  }

  // 일반 텍스트 필드 (work_*, notes)
  const v = service[fieldKey as keyof ReadyService];
  return (
    <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-xs text-ink">
      {typeof v === "string" ? v : ""}
    </pre>
  );
}

/* ──────────────────────────── Step4: 완료 ──────────────────────────── */

function Step4({
  service,
  to,
  mailWarning,
  onRestart,
}: {
  service: ReadyService;
  to: Operator;
  mailWarning: string | null;
  onRestart: () => void;
}) {
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="text-5xl" aria-hidden>
        🎉
      </div>
      <h3 className="text-xl font-bold text-ink">인수인계 완료</h3>
      <p className="max-w-md text-center text-sm text-ink-soft">
        <span className="font-medium text-ink">
          {service.application_type ? `${service.application_type} ` : ""}
          {service.university_name} · {service.service_name}
        </span>
        <br />
        인계 요청이 <span className="font-medium">{to.name}</span>에게
        전달되었습니다.
        {!mailWarning && (
          <>
            <br />
            메일이 발송되었고 PDF 인수인계 자료가 첨부되었습니다.
          </>
        )}
      </p>
      {mailWarning && (
        <p className="max-w-md text-center text-xs text-vermilion">
          ⚠ {mailWarning}
          <br />
          진행 자체는 등록되었습니다. 인수인계 확인 탭에서 수동으로 처리할 수
          있습니다.
        </p>
      )}
      <button
        type="button"
        onClick={onRestart}
        className="cursor-pointer border border-line bg-transparent px-5 py-2 text-sm tracking-[0.04em] text-ink hover:border-vermilion hover:text-vermilion"
      >
        새 인계 시작
      </button>
    </section>
  );
}
