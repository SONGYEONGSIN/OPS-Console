"use client";

import { useActionState, useState } from "react";
import type { ViewProps } from "../types";
import {
  sendDataRequestAction,
  type DataRequestActionState,
} from "@/features/data-requests/actions";
import { buildDefaultDataRequestText } from "@/features/data-requests/mail-template";

type Recipient = { email: string; name: string; department: string | null; universityName: string };

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

      <input type="hidden" name="universityName" value={row.universityName ?? ""} />
      <input type="hidden" name="serviceId" value={row.id} />
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
      <button
        type="submit"
        disabled={pending || !toEmail}
        className="w-full cursor-pointer border border-vermilion bg-vermilion px-3 py-1.5 text-sm font-medium text-cream transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-50"
      >
        {pending ? "발송 중…" : "발송"}
      </button>
    </form>
  );
}
