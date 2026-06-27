"use client";

import { useMemo, useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";
import { parseEmailList } from "@/lib/email";

type Props = {
  /** 견적서 수신처(수신 칸) — 안내 표시용. */
  recipientName: string;
  busy: boolean;
  onClose: () => void;
  onSend: (emails: string[]) => void;
};

/**
 * 견적서 외부 메일 발송 모달 — 외부 수신자(고객) 이메일 직접 입력.
 * 내부 운영자 목록 없이 이메일만 받아 실제 주소만 발송한다.
 */
export function QuoteMailModal({
  recipientName,
  busy,
  onClose,
  onSend,
}: Props) {
  const [freeText, setFreeText] = useState("");
  const { emails, invalid } = useMemo(
    () => parseEmailList(freeText),
    [freeText],
  );

  return (
    <ModalShell
      title="견적서 메일 발송"
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
        {recipientName && (
          <p className="text-xs text-muted">
            수신처: <span className="text-ink">{recipientName}</span>
          </p>
        )}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink">
            받는 사람 이메일{" "}
            <span className="font-normal text-muted">
              (외부 · 콤마·줄바꿈으로 구분)
            </span>
          </p>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={3}
            placeholder="customer@example.com, staff@example.com"
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
        <p className="text-xs text-muted">
          저장된 내용 기준으로 PDF가 첨부됩니다. 변경 후에는 먼저 저장하세요.
        </p>
      </div>
    </ModalShell>
  );
}
