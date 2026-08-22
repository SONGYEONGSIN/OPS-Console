"use client";

import { useActionState, useState } from "react";
import { kstFormat } from "@/lib/kst-format";
import {
  sendOpenNoticeAction,
  type OpenNoticeActionState,
} from "@/features/open-notices/actions";
import { buildDefaultOpenNoticeText } from "@/features/open-notices/mail-template";
import { DateInput } from "@/components/common/DateInput";
import type { ViewProps } from "../types";
import { BADGE_TONE } from "../badge-tone";

type Recipient = {
  email: string;
  name: string;
  department: string | null;
  universityName: string;
};

/** ISO → KST 'YYYY.MM.DD HH:mm'. 없으면 빈 문자열. */
function formatKstDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = kstFormat({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value;
  const [y, m, d, hh, mi] = [g("year"), g("month"), g("day"), g("hour"), g("minute")];
  return y && m && d && hh && mi ? `${y}.${m}.${d} ${hh}:${mi}` : "";
}

const inputClass =
  "w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white";

export function OpenNoticeView({ row }: ViewProps) {
  const recipients = (row.openNoticeRecipients ?? []) as Recipient[];
  const sender = row.openNoticeSender;
  const canSend = row.openNoticeCanSend !== false;
  const mailStatus = row.openNoticeStatus ?? null;

  const defaults = buildDefaultOpenNoticeText({
    operatorName: sender?.name ?? "",
    universityName: row.universityName ?? "",
    serviceName: row.serviceName ?? row.name,
    serviceId: row.serviceIdNum ?? 0,
    admissionType: row.applicationType,
    writeStartAt: row.writeStartAt,
    writeEndAt: row.writeEndAt,
  });

  const [state, formAction, pending] = useActionState<
    OpenNoticeActionState,
    FormData
  >(sendOpenNoticeAction, undefined);
  const [toEmail, setToEmail] = useState("");
  const [cc, setCc] = useState<Recipient[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  /** 이미 보낸 건은 한 번 더 눌러야 나간다 (오픈안내는 1회성이다) */
  const [confirmingResend, setConfirmingResend] = useState(false);

  const toRecipient = recipients.find((r) => r.email === toEmail);
  const alreadySent = mailStatus === "sent";
  const needsConfirm = alreadySent && !confirmingResend;

  const selectTo = (email: string) => {
    setCc((prev) => prev.filter((c) => c.email !== email));
    setToEmail(email);
  };
  const addCc = (email: string) => {
    const r = recipients.find((x) => x.email === email);
    if (r && !cc.some((c) => c.email === email) && email !== toEmail)
      setCc([...cc, r]);
  };
  const removeCc = (email: string) => setCc(cc.filter((c) => c.email !== email));

  const heading = `${row.universityName} · ${row.serviceName ?? row.name}`;

  if (!canSend) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-ink">{heading}</h2>
        <p className="text-xs text-muted">
          본인이 담당한 서비스만 발송할 수 있습니다. 담당 운영자는{" "}
          {row.operatorName || "미지정"}입니다.
        </p>
      </div>
    );
  }

  if (recipients.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-ink">{heading}</h2>
        <p className="text-xs text-muted">
          이 대학에 등록된 연락처 이메일이 없습니다. 대학연락처에서 이메일을 먼저
          등록하세요.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <h2 className="text-lg font-medium text-ink">{heading}</h2>

      {mailStatus === "scheduled" ? (
        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-block px-2 py-0.5 text-2xs ${BADGE_TONE.idle}`}>
            예약완료
          </span>
          {row.openNoticeScheduledAt ? (
            <span className="text-muted">
              {formatKstDateTime(row.openNoticeScheduledAt)} 발송 예정
            </span>
          ) : null}
        </div>
      ) : alreadySent ? (
        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-block px-2 py-0.5 text-2xs ${BADGE_TONE.done}`}>
            발송완료
          </span>
          {row.openNoticeLastSentAt ? (
            <span className="text-muted">
              {formatKstDateTime(row.openNoticeLastSentAt)} 발송
            </span>
          ) : null}
        </div>
      ) : null}

      <input type="hidden" name="serviceId" value={row.serviceIdNum ?? ""} />
      <input type="hidden" name="universityName" value={row.universityName ?? ""} />
      <input type="hidden" name="serviceName" value={row.serviceName ?? row.name} />
      <input type="hidden" name="mode" value={sendMode} />
      <input type="hidden" name="toEmail" value={toEmail} />
      <input type="hidden" name="toName" value={toRecipient?.name ?? ""} />
      <input
        type="hidden"
        name="cc"
        value={JSON.stringify(cc.map((c) => ({ email: c.email, name: c.name })))}
      />

      <div className="block text-xs">
        <span className="mb-1 block text-muted">발신자</span>
        <div className="w-full border border-line bg-washi-raised px-2 py-1 text-ink">
          {sender ? `${sender.name} · ${sender.email}` : "본인 메일박스에서 발송"}
        </div>
      </div>

      <div className="block text-xs">
        <span className="mb-1 block text-muted">수신자</span>
        <select
          aria-label="수신자 선택"
          value={toEmail}
          onChange={(e) => {
            if (e.target.value) selectTo(e.target.value);
          }}
          className={inputClass}
        >
          <option value="">수신자 선택</option>
          {recipients.map((r) => (
            <option key={r.email} value={r.email}>
              {r.name}
              {r.department ? ` (${r.department})` : ""} · {r.email}
            </option>
          ))}
        </select>
      </div>

      <div className="block text-xs">
        <span className="mb-1 block text-muted">참조 (CC)</span>
        {toEmail && (
          <select
            aria-label="참조 추가"
            value=""
            onChange={(e) => {
              if (e.target.value) addCc(e.target.value);
            }}
            className={inputClass}
          >
            <option value="">참조 추가</option>
            {recipients
              .filter(
                (r) => r.email !== toEmail && !cc.some((c) => c.email === r.email),
              )
              .map((r) => (
                <option key={r.email} value={r.email}>
                  {r.name} · {r.email}
                </option>
              ))}
          </select>
        )}
        {cc.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {cc.map((c) => (
              <span
                key={c.email}
                className="inline-flex items-center gap-1 border border-line px-2 py-0.5 text-ink"
              >
                {c.name}
                <button
                  type="button"
                  onClick={() => removeCc(c.email)}
                  aria-label={`${c.name} 참조 제거`}
                  className="cursor-pointer text-muted hover:text-vermilion"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">제목</span>
        <input
          type="text"
          name="subject"
          defaultValue={defaults.subject}
          placeholder="제목을 입력하세요"
          className={inputClass}
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">본문</span>
        <textarea
          name="body"
          rows={20}
          defaultValue={defaults.body}
          placeholder="안내 내용을 입력하세요"
          className={`${inputClass} leading-relaxed`}
        />
      </label>

      {state ? (
        <p className={`text-xs ${state.ok ? "text-ink" : "text-vermilion"}`}>
          {state.message}
        </p>
      ) : null}

      <div className="block text-xs" role="radiogroup" aria-label="발송 모드">
        <span className="mb-1 block text-muted">발송 모드</span>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={sendMode === "now"}
            onClick={() => setSendMode("now")}
            className={`flex-1 cursor-pointer border border-line px-3 py-1.5 text-xs ${
              sendMode === "now"
                ? "bg-ink text-cream"
                : "bg-white text-ink hover:border-ink hover:bg-ink hover:text-cream"
            }`}
          >
            지금 발송
          </button>
          <button
            type="button"
            aria-pressed={sendMode === "schedule"}
            onClick={() => setSendMode("schedule")}
            className={`flex-1 cursor-pointer border border-line px-3 py-1.5 text-xs ${
              sendMode === "schedule"
                ? "border-vermilion bg-vermilion text-cream"
                : "bg-white text-ink hover:border-ink hover:bg-ink hover:text-cream"
            }`}
          >
            예약 발송
          </button>
        </div>
      </div>

      {sendMode === "schedule" ? (
        <label className="block text-xs">
          <span className="mb-1 block text-muted">예약 시각 (KST)</span>
          <DateInput
            type="datetime-local"
            name="scheduledAt"
            aria-label="예약 시각"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
            className={inputClass}
          />
        </label>
      ) : null}

      {needsConfirm ? (
        <p className="text-xs text-vermilion">
          이미 발송한 서비스입니다. 다시 보내려면 한 번 더 누르세요.
        </p>
      ) : null}

      <div className="flex gap-2 pt-2">
        <button
          type={needsConfirm ? "button" : "submit"}
          onClick={needsConfirm ? () => setConfirmingResend(true) : undefined}
          disabled={pending || !toEmail || (sendMode === "schedule" && !scheduledAt)}
          className="flex-1 cursor-pointer border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:cursor-default disabled:opacity-50"
        >
          {pending ? "발송 중…" : needsConfirm ? "재발송 확인" : "발송"}
        </button>
        <button
          type="button"
          onClick={() => {
            setToEmail("");
            setCc([]);
            setScheduledAt("");
            setSendMode("now");
            setConfirmingResend(false);
          }}
          className="flex-1 cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:border-ink hover:bg-ink hover:text-cream"
        >
          취소
        </button>
      </div>
    </form>
  );
}
