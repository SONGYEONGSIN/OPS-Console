"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadReceipt } from "@/features/postal/actions";
import type { ReceiptCard } from "@/features/postal/queries";

/**
 * 우편물 화면 — 영수증을 끌어다 놓고, 올린 것을 카드로 본다.
 *
 * 이미지는 서버가 발급한 **짧은 만료 서명 URL**이다. 버킷이 비공개라 이 URL 없이는
 * 열리지 않는다 — 영수증에 수취인 실명과 카드 결제 정보가 찍혀 있기 때문이다.
 */
export function PostalClient({ receipts }: { receipts: ReceiptCard[] }) {
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function send(files: File[]) {
    if (files.length === 0) return;
    setErrors([]);
    startTransition(async () => {
      const failed: string[] = [];
      // 한 장이 막혀도 나머지는 올린다 — 여러 장을 한꺼번에 떨구는 게 보통이다.
      for (const f of files) {
        const r = await uploadReceipt(f);
        if (!r.ok) failed.push(`${f.name} — ${r.error}`);
      }
      setErrors(failed);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div
        data-testid="postal-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          send(Array.from(e.dataTransfer?.files ?? []));
        }}
        className={`border border-dashed px-5 py-8 text-center transition-colors ${
          dragOver
            ? "border-vermilion bg-vermilion/10"
            : "border-line bg-situation-bg"
        }`}
      >
        <p className="text-sm text-ink">
          {pending ? "올리는 중…" : "등기발송 영수증을 여기로 끌어다 놓으세요"}
        </p>
        <p className="mt-1 text-2xs text-muted">
          사진 파일(JPG · PNG · HEIC) · 여러 장을 한 번에 놓아도 됩니다
        </p>
        <label className="mt-3 inline-block cursor-pointer border border-line px-3 py-1 text-xs text-ink transition-colors hover:bg-washi">
          파일 선택
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => send(Array.from(e.target.files ?? []))}
          />
        </label>
      </div>

      {errors.length > 0 && (
        <div className="border border-vermilion-deep bg-situation-bg p-3">
          {/* 실패 이유를 그대로 보여준다. 요약하면 왜 안 됐는지 알 수 없다. */}
          {errors.map((e) => (
            <p key={e} className="text-xs text-vermilion-deep">
              {e}
            </p>
          ))}
        </div>
      )}

      {receipts.length === 0 ? (
        <p className="text-sm text-muted">아직 올린 영수증이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {receipts.map((r) => (
            <ReceiptItem key={r.id} receipt={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReceiptItem({ receipt }: { receipt: ReceiptCard }) {
  const when = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(receipt.createdAt));

  return (
    <figure className="flex flex-col gap-2 border border-line bg-situation-bg p-3">
      {receipt.imageUrl ? (
        <a href={receipt.imageUrl} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={receipt.imageUrl}
            alt={`등기발송 영수증 (${when})`}
            className="h-56 w-full cursor-pointer object-cover object-top transition-opacity hover:opacity-90"
          />
        </a>
      ) : (
        // 빈칸으로 두면 사진이 없는 건지 못 여는 건지 알 수 없다.
        <div className="flex h-56 w-full items-center justify-center bg-washi px-3 text-center text-2xs text-muted">
          지금은 열 수 없습니다 — 화면을 새로 고치면 다시 열립니다
        </div>
      )}
      <figcaption className="flex items-baseline justify-between text-2xs">
        <span className="text-ink">{receipt.uploadedBy}</span>
        <span className="text-muted">{when}</span>
      </figcaption>
    </figure>
  );
}
