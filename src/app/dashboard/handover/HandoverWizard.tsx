"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHandoverProgress } from "@/features/handover/progress-actions";
import { sendHandoverMail } from "@/features/handover/mail-actions";
import {
  HANDOVER_CATEGORIES,
  type HandoverFieldKey,
} from "@/features/handover/categories";
import type { ReadyService } from "@/features/handover/progress-queries";

type Operator = {
  email: string;
  name: string;
  team?: string | null;
  role?: string | null;
};
type Props = {
  services: ReadyService[];
  operators: Operator[];
};

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ["서비스 선택", "인수자 선택", "최종 확인", "인수인계 완료"];

function formatDate(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function HandoverWizard({ services, operators }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [serviceId, setServiceId] = useState<string>("");
  const [to, setTo] = useState<Operator | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mailWarning, setMailWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedService = services.find((s) => s.id === serviceId);

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
      <ProgressBar step={step} />
      <div className="mt-8 flex-1">
        {step === 1 && (
          <Step1
            services={services}
            serviceId={serviceId}
            onSelect={setServiceId}
          />
        )}
        {step === 2 && (
          <Step2 operators={operators} to={to} onSelect={setTo} />
        )}
        {step === 3 && selectedService && to && (
          <Step3
            service={selectedService}
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
              className="cursor-pointer border border-line bg-transparent px-5 py-2 text-sm tracking-[0.04em] text-ink hover:border-vermilion hover:text-vermilion"
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
              className="cursor-pointer border border-ink bg-ink px-5 py-2 text-sm tracking-[0.04em] text-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              다음 →
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              disabled={!to}
              onClick={() => setStep(3)}
              className="cursor-pointer border border-ink bg-ink px-5 py-2 text-sm tracking-[0.04em] text-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              다음 →
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleConfirm}
              className="cursor-pointer border border-ink bg-ink px-5 py-2 text-sm tracking-[0.04em] text-cream disabled:cursor-not-allowed disabled:opacity-50"
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

function ProgressBar({ step }: { step: Step }) {
  return (
    <ol className="flex items-center text-xs">
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const active = n === step;
        const isLast = i === STEP_LABELS.length - 1;
        return (
          <li
            key={label}
            className={`flex items-center ${isLast ? "" : "flex-1"}`}
          >
            <div
              className={`flex flex-shrink-0 items-center gap-2 transition-all ${
                active ? "scale-105" : ""
              }`}
            >
              <span
                className={`inline-flex h-9 w-9 items-center justify-center border-2 text-sm font-semibold transition-all ${
                  active
                    ? "border-vermilion bg-vermilion text-cream shadow-[2px_2px_0_var(--vermilion-deep)]"
                    : done
                      ? "border-sage bg-sage text-cream"
                      : "border-line bg-cream text-muted"
                }`}
              >
                {done ? "✓" : n}
              </span>
              <span
                className={`whitespace-nowrap text-sm ${
                  active
                    ? "font-bold text-ink"
                    : done
                      ? "text-ink-soft"
                      : "text-muted"
                }`}
              >
                {label}
              </span>
              {active && (
                <span
                  aria-hidden
                  className="ml-1 inline-block h-2 w-2 animate-pulse bg-vermilion"
                />
              )}
            </div>
            {!isLast && (
              <span
                aria-hidden
                className={`mx-3 h-0.5 flex-1 transition-colors ${
                  done ? "bg-sage" : "bg-line"
                }`}
              />
            )}
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
}: {
  services: ReadyService[];
  serviceId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="space-y-4">
      <header className="flex items-baseline gap-3">
        <h3 className="text-xl font-bold text-ink">1 · 서비스 선택</h3>
        <span className="text-sm text-vermilion">{services.length}건</span>
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
  to,
  notes,
  onNotesChange,
  error,
}: {
  service: ReadyService;
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
          <span className="font-medium">{service.university_name}</span>
          <span className="ml-1 text-xs text-muted">
            · {service.service_name}
          </span>
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
  const filled = category.fields.filter((f) => {
    const key = `${f.key.replace(/_md$/, "_md")}` as HandoverFieldKey;
    const v = service[key as keyof ReadyService];
    return typeof v === "string" && v.trim().length > 0;
  }).length;
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
          {category.fields.map((f) => {
            const v = service[f.key as keyof ReadyService];
            const text = typeof v === "string" ? v : "";
            return (
              <div key={f.key}>
                <div className="text-xs text-muted">{f.label}</div>
                {text ? (
                  <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-xs text-ink">
                    {text}
                  </pre>
                ) : (
                  <p className="mt-1 text-xs italic text-muted">(미작성)</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
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
      <div className="flex h-16 w-16 items-center justify-center border-2 border-sage bg-sage/20 text-2xl text-sage">
        ✓
      </div>
      <h3 className="text-xl font-bold text-ink">인수인계 완료</h3>
      <p className="max-w-md text-center text-sm text-ink-soft">
        <span className="font-medium text-ink">
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
