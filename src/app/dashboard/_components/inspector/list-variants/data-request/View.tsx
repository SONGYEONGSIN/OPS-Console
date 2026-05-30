"use client";

import { useActionState, useState } from "react";
import type { ViewProps } from "../types";
import {
  sendDataRequestAction,
  type DataRequestActionState,
} from "@/features/data-requests/actions";
import { buildDefaultDataRequestText } from "@/features/data-requests/mail-template";
import { DateInput } from "@/components/common/DateInput";

type Recipient = { email: string; name: string; department: string | null; universityName: string };

/** ISO → KST 'YYYY.MM.DD HH:mm'. null/실패 시 빈 문자열. */
function formatKstDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value;
  const [y, m, d, hh, mi] = [g("year"), g("month"), g("day"), g("hour"), g("minute")];
  return y && m && d && hh && mi ? `${y}.${m}.${d} ${hh}:${mi}` : "";
}

export function DataRequestView({ row }: ViewProps) {
  const recipients = (row.dataRequestRecipients ?? []) as Recipient[];
  const sender = row.dataRequestSender;
  const sched = row.dataRequestLastSchedule;
  const defaults = buildDefaultDataRequestText({
    operatorName: sender?.name ?? "",
    universityName: row.universityName ?? "",
    serviceName: row.serviceName ?? row.name,
    writeStart: sched?.start ?? "",
    writeEnd: sched?.end ?? "",
  });
  const [state, formAction, pending] = useActionState<DataRequestActionState, FormData>(
    sendDataRequestAction,
    undefined,
  );
  const [search, setSearch] = useState("");
  const [justSelected, setJustSelected] = useState(false);
  const [toEmail, setToEmail] = useState("");
  const [cc, setCc] = useState<Recipient[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  /** 발송 모드 — now=지금 발송, schedule=예약 발송 (backup 패턴) */
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");

  const mailStatus = row.dataRequestStatus ?? null;

  const term = search.trim().toLowerCase();
  const matches =
    term === ""
      ? []
      : recipients.filter(
          (r) => r.name.toLowerCase().includes(term) || r.email.toLowerCase().includes(term),
        );
  const toRecipient = recipients.find((r) => r.email === toEmail);

  const selectTo = (r: Recipient) => {
    setCc((prev) => prev.filter((c) => c.email !== r.email));
    setToEmail(r.email);
    setSearch(r.name);
    setJustSelected(true);
  };
  const addCc = (email: string) => {
    const r = recipients.find((x) => x.email === email);
    if (r && !cc.some((c) => c.email === email) && email !== toEmail) setCc([...cc, r]);
  };
  const removeCc = (email: string) => setCc(cc.filter((c) => c.email !== email));

  const inputClass =
    "w-full border border-line bg-cream px-2 py-1 text-ink focus:border-vermilion focus:outline-none";

  if (recipients.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-ink">
          {row.universityName} · {row.serviceName ?? row.name}
        </h2>
        <p className="text-xs text-muted">
          이 대학에 등록된 연락처 이메일이 없습니다. 대학연락처에서 이메일을 먼저 등록하세요.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <h2 className="text-lg font-medium text-ink">
        {row.universityName} · {row.serviceName ?? row.name}
      </h2>

      {mailStatus === "scheduled" ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-block bg-washi-raised px-2 py-0.5 text-2xs text-ink">
            예약됨
          </span>
          {row.dataRequestScheduledAt ? (
            <span className="text-muted">
              {formatKstDateTime(row.dataRequestScheduledAt)} 발송 예정
            </span>
          ) : null}
        </div>
      ) : mailStatus === "sent" ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-block bg-sage/15 px-2 py-0.5 text-2xs text-sage">
            발송됨
          </span>
          {row.dataRequestLastSentAt ? (
            <span className="text-muted">
              {formatKstDateTime(row.dataRequestLastSentAt)} 발송
            </span>
          ) : null}
        </div>
      ) : null}

      <input type="hidden" name="universityName" value={row.universityName ?? ""} />
      <input type="hidden" name="serviceId" value={row.id} />
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
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setJustSelected(false);
          }}
          placeholder="연락처 검색 (이름/이메일)"
          className={inputClass}
        />
        {!justSelected && matches.length > 0 && (
          <ul
            aria-label="수신자 검색 결과"
            className="mt-1 max-h-40 overflow-y-auto border border-line-soft bg-washi-raised"
          >
            {matches.map((r) => (
              <li key={r.email}>
                <button
                  type="button"
                  onClick={() => selectTo(r)}
                  className="block w-full cursor-pointer border-none bg-transparent px-2 py-1 text-left text-2xs text-ink hover:bg-line-soft"
                >
                  {r.name}
                  {r.department ? ` (${r.department})` : ""} · {r.email}
                </button>
              </li>
            ))}
          </ul>
        )}
        {toRecipient && (
          <p className="mt-1 text-2xs text-muted">
            받는 사람: <span className="text-ink">{toRecipient.name} · {toRecipient.email}</span>
          </p>
        )}
      </div>

      <div className="block text-xs">
        <span className="mb-1 block text-muted">참조 (CC)</span>
        {cc.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
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
        {toEmail && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addCc(e.target.value);
            }}
            className={inputClass}
          >
            <option value="">참조 추가</option>
            {recipients
              .filter((r) => r.email !== toEmail && !cc.some((c) => c.email === r.email))
              .map((r) => (
                <option key={r.email} value={r.email}>
                  {r.name} · {r.email}
                </option>
              ))}
          </select>
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
          rows={12}
          defaultValue={defaults.body}
          placeholder="요청 내용을 입력하세요"
          className={`${inputClass} leading-relaxed`}
        />
      </label>

      {state ? (
        <p className={`text-xs ${state.ok ? "text-ink" : "text-vermilion"}`}>{state.message}</p>
      ) : null}

      {/* 발송 모드 — 지금 발송 / 예약 발송 (backup 패턴: gap 분리 + 각 버튼 border) */}
      <div className="block text-xs" role="radiogroup" aria-label="발송 모드">
        <span className="mb-1 block text-muted">발송 모드</span>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={sendMode === "now"}
            onClick={() => setSendMode("now")}
            className={`flex-1 cursor-pointer border border-line px-3 py-1.5 text-xs ${
              sendMode === "now" ? "bg-ink text-cream" : "bg-cream text-ink hover:bg-washi"
            }`}
          >
            지금 발송
          </button>
          <button
            type="button"
            aria-pressed={sendMode === "schedule"}
            onClick={() => setSendMode("schedule")}
            className={`flex-1 cursor-pointer border border-line px-3 py-1.5 text-xs ${
              sendMode === "schedule" ? "bg-ink text-cream" : "bg-cream text-ink hover:bg-washi"
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

      {/* 저장/취소 — 백업요청과 동일 레이아웃 (primary=ink, 취소=outline). 자료요청은
          즉시 발송 액션이라 primary 라벨만 모드별, 취소는 입력 초기화. */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending || !toEmail || (sendMode === "schedule" && !scheduledAt)}
          className="flex-1 cursor-pointer border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:cursor-default disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          onClick={() => {
            setToEmail("");
            setCc([]);
            setSearch("");
            setJustSelected(false);
            setScheduledAt("");
            setSendMode("now");
          }}
          className="flex-1 cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
    </form>
  );
}
