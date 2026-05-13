"use client";

import { useState, useTransition } from "react";
import { sendBackupRequestMail } from "@/features/backup-requests/mail-actions";

type Props = {
  backupRequestId: string;
};

export function ResendMailButton({ backupRequestId }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const onClick = () => {
    setMessage(null);
    startTransition(async () => {
      const r = await sendBackupRequestMail({
        backup_request_id: backupRequestId,
      });
      if (r.ok) {
        setMessage(
          r.status === "dry_run" ? "테스트 모드로 발송됨" : "재발송 완료",
        );
      } else {
        setMessage(`발송 실패: ${r.error}`);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex w-fit items-center rounded-md border border-vermilion bg-vermilion px-3 py-1.5 text-xs font-medium text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "재발송 중…" : "메일 재발송"}
      </button>
      {message && <p className="text-2xs text-muted">{message}</p>}
    </div>
  );
}
