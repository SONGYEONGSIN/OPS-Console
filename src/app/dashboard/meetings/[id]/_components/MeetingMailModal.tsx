"use client";

import { useMemo, useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";
import { OPERATORS } from "@/features/auth/operators";
import { collectRecipients } from "@/features/meetings/recipients";

type Props = {
  /** 회의 참석자 이름들 — 운영자와 이름이 일치하면 초기 선택. */
  attendees: string[];
  busy: boolean;
  onClose: () => void;
  onSend: (emails: string[]) => void;
};

/**
 * 회의록 메일 발송 모달 — 운영자 목록 체크 + 직접 이메일 입력.
 * 참석자 "이름"을 수신 주소로 쓰던 버그를 막고, 실제 이메일만 수신자로 모은다.
 */
export function MeetingMailModal({ attendees, busy, onClose, onSend }: Props) {
  // 참석자 이름과 일치하는 운영자는 초기 선택(이름→이메일 브리지).
  const [selected, setSelected] = useState<Set<string>>(() => {
    const names = new Set(attendees.map((a) => a.trim()));
    return new Set(
      OPERATORS.filter((o) => names.has(o.name)).map((o) => o.email),
    );
  });
  const [freeText, setFreeText] = useState("");

  const { emails, invalid } = useMemo(
    () => collectRecipients([...selected], freeText),
    [selected, freeText],
  );

  function toggle(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  return (
    <ModalShell
      title="회의록 메일 발송"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border border-line bg-transparent px-3 py-1 text-xs text-ink hover:bg-washi"
          >
            취소
          </button>
          <button
            type="button"
            disabled={busy || emails.length === 0}
            onClick={() => onSend(emails)}
            className="border border-ink bg-ink px-4 py-1 text-xs font-medium text-cream transition-colors hover:bg-vermilion disabled:opacity-50"
          >
            {busy ? "발송 중…" : `발송 (${emails.length})`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink">운영자 선택</p>
          <div className="max-h-[240px] overflow-y-auto border border-line">
            <ul className="divide-y divide-line-soft">
              {OPERATORS.map((o) => (
                <li key={o.email}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-washi-raised">
                    <input
                      type="checkbox"
                      checked={selected.has(o.email)}
                      onChange={() => toggle(o.email)}
                      className="accent-ink"
                    />
                    <span className="font-medium text-ink">{o.name}</span>
                    <span className="text-muted">
                      {o.team} · {o.role}
                    </span>
                    <span className="ml-auto truncate text-muted">
                      {o.email}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink">
            직접 입력{" "}
            <span className="font-normal text-muted">
              (콤마·줄바꿈으로 구분)
            </span>
          </p>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={2}
            placeholder="extra@example.com, other@example.com"
            className="w-full border border-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink"
          />
        </div>

        {invalid.length > 0 && (
          <p className="text-xs text-vermilion">
            ! 이메일 형식이 아니어서 제외됨: {invalid.join(", ")}
          </p>
        )}
        <p className="text-xs text-muted">
          수신 {emails.length}명
          {emails.length > 0 && ` — ${emails.join(", ")}`}
        </p>
      </div>
    </ModalShell>
  );
}
