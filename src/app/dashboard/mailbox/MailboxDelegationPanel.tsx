"use client";

import { useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";
import {
  grantMailboxDelegation,
  revokeMailboxDelegation,
} from "@/features/mailbox/actions";
import type { MailboxDelegation } from "@/features/mailbox/schemas";
import { operatorNameByEmail } from "@/features/auth/operators";

type Candidate = { email: string; name: string };

/** 위임 관리 — 내가 준 위임 목록 + 추가(조직 운영자 선택)/해제(owner=me 고정 서버 액션). */
export function MailboxDelegationPanel({
  delegations,
  candidates,
}: {
  delegations: MailboxDelegation[];
  candidates: Candidate[];
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setPending(true);
    setMsg(null);
    const r = await fn();
    setPending(false);
    if (!r.ok) setMsg(r.error ?? "실패했습니다.");
    else setMsg(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center border border-ink bg-ink px-3 py-1 text-xs font-medium text-cream transition-opacity hover:opacity-90"
      >
        메일함 위임
      </button>
      {open ? (
        <ModalShell title="메일함 위임 관리" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-4 px-1 py-1">
            <p className="text-xs text-muted">
              위임하면 상대가 내 메일함을 열람하고 내 명의로 회신할 수 있습니다.
            </p>

            <div className="flex items-center gap-2">
              <select
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="위임할 운영자 선택"
                className="flex-1 border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:bg-white focus:border-vermilion"
              >
                <option value="">위임할 운영자 선택</option>
                {candidates.map((c) => (
                  <option key={c.email} value={c.email}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={pending || !email}
                onClick={() =>
                  run(async () => {
                    const r = await grantMailboxDelegation(email);
                    if (r.ok) setEmail("");
                    return r;
                  })
                }
                className="inline-flex items-center border border-vermilion bg-vermilion px-3 py-2 text-sm text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                위임
              </button>
            </div>
            {msg ? <span className="text-xs text-vermilion">{msg}</span> : null}

            <ul className="flex flex-col divide-y divide-line border-t border-line">
              {delegations.length === 0 ? (
                <li className="py-3 text-xs text-muted">
                  위임한 운영자가 없습니다.
                </li>
              ) : (
                delegations.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between py-2 text-sm text-ink"
                  >
                    <span>
                      {operatorNameByEmail(d.grantee_email) || d.grantee_email}
                      <span className="ml-2 text-xs text-muted">
                        {d.grantee_email}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() => revokeMailboxDelegation(d.grantee_email))
                      }
                      className="text-xs text-muted transition-colors hover:text-vermilion disabled:opacity-50"
                    >
                      해제
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
