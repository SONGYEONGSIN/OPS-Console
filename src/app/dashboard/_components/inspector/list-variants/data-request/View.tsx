"use client";

import { useActionState, useState } from "react";
import type { ViewProps } from "../types";
import { Section } from "../shared";
import {
  sendDataRequestAction,
  type DataRequestActionState,
} from "@/features/data-requests/actions";

type Recipient = {
  email: string;
  name: string;
  department: string | null;
  universityName: string;
};

export function DataRequestView({ row }: ViewProps) {
  const recipients = (row.dataRequestRecipients ?? []) as Recipient[];
  const [state, formAction, pending] = useActionState<DataRequestActionState, FormData>(
    sendDataRequestAction,
    undefined,
  );
  const [search, setSearch] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [cc, setCc] = useState<Recipient[]>([]);

  const term = search.trim().toLowerCase();
  const filtered = recipients.filter(
    (r) =>
      term === "" ||
      r.name.toLowerCase().includes(term) ||
      r.email.toLowerCase().includes(term),
  );
  const toRecipient = recipients.find((r) => r.email === toEmail);

  const addCc = (email: string) => {
    const r = recipients.find((x) => x.email === email);
    if (r && !cc.some((c) => c.email === email) && email !== toEmail) {
      setCc([...cc, r]);
    }
  };
  const removeCc = (email: string) => setCc(cc.filter((c) => c.email !== email));

  if (recipients.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-ink">
          {row.universityName} · {row.serviceName ?? row.name}
        </h2>
        <p className="text-sm text-muted">
          이 대학에 등록된 연락처 이메일이 없습니다. 대학연락처에서 이메일을 먼저 등록하세요.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <h2 className="text-lg font-medium text-ink">
        {row.universityName} · {row.serviceName ?? row.name}
      </h2>

      <input type="hidden" name="universityName" value={row.universityName ?? ""} />
      <input type="hidden" name="serviceId" value={row.id} />
      <input type="hidden" name="serviceName" value={row.serviceName ?? row.name} />
      <input type="hidden" name="toEmail" value={toEmail} />
      <input type="hidden" name="toName" value={toRecipient?.name ?? ""} />
      <input
        type="hidden"
        name="cc"
        value={JSON.stringify(cc.map((c) => ({ email: c.email, name: c.name })))}
      />

      <Section title="수신자">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="연락처 검색 (이름/이메일)"
          className="w-full border border-line bg-transparent px-3 py-1.5 text-sm focus:border-vermilion focus:outline-none"
        />
        <select
          value={toEmail}
          onChange={(e) => {
            const next = e.target.value;
            setCc((prev) => prev.filter((c) => c.email !== next));
            setToEmail(next);
          }}
          className="mt-2 w-full border border-line bg-transparent px-3 py-1.5 text-sm focus:border-vermilion focus:outline-none"
        >
          <option value="">받는 사람 선택</option>
          {filtered.map((r) => (
            <option key={r.email} value={r.email}>
              {r.name}
              {r.department ? ` (${r.department})` : ""} · {r.email}
            </option>
          ))}
        </select>
      </Section>

      <Section title="참조 (CC)">
        <div className="flex flex-wrap gap-1.5">
          {cc.map((c) => (
            <span
              key={c.email}
              className="inline-flex items-center gap-1 border border-line px-2 py-0.5 text-xs text-ink"
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
        {toEmail && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addCc(e.target.value);
            }}
            className="mt-2 w-full border border-line bg-transparent px-3 py-1.5 text-sm focus:border-vermilion focus:outline-none"
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
      </Section>

      <Section title="제목">
        <input
          type="text"
          name="subject"
          placeholder="제목을 입력하세요"
          className="w-full border border-line bg-transparent px-3 py-1.5 text-sm focus:border-vermilion focus:outline-none"
        />
      </Section>

      <Section title="본문">
        <textarea
          name="body"
          rows={8}
          placeholder="요청 내용을 입력하세요"
          className="w-full border border-line bg-transparent px-3 py-2 text-sm leading-relaxed focus:border-vermilion focus:outline-none"
        />
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !toEmail}
          className="inline-flex w-fit items-center border border-vermilion bg-vermilion px-3 py-1 text-xs font-medium text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "발송 중…" : "발송"}
        </button>
        {state != null ? (
          <span className={`text-xs ${state.ok ? "text-ink" : "text-vermilion"}`}>
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
