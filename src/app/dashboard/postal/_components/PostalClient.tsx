"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadReceipt } from "@/features/postal/actions";
import type { ReceiptCard, ExtractState } from "@/features/postal/queries";
import { PostalTable } from "./PostalTable";
import { LedgerTable } from "./LedgerTable";
import type { LedgerView } from "@/features/postal/ledger-view";

/**
 * 우편물 화면 — 영수증을 끌어다 놓고, 올린 것을 표로 본다(원본은 행을 눌러 팝업).
 *
 * 이미지는 서버가 발급한 **짧은 만료 서명 URL**이다. 버킷이 비공개라 이 URL 없이는
 * 열리지 않는다 — 영수증에 수취인 실명과 카드 결제 정보가 찍혀 있기 때문이다.
 */
export function PostalClient({
  receipts,
  extractStates = {},
  ledger,
  ledgerUrl = null,
}: {
  receipts: ReceiptCard[];
  extractStates?: Record<string, ExtractState>;
  ledger: LedgerView;
  /** 원본 엑셀 바로가기 — 조회 실패면 null. */
  ledgerUrl?: string | null;
}) {
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
        <label className="mt-3 inline-block cursor-pointer border border-line px-3 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream">
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

      {/*
        검토 대기 — 올렸지만 아직 확정 안 된 영수증. **일감**이라 위에 둔다.
        확정하면 여기서 사라지고 아래 대장에 행으로 남는다.
      */}
      {receipts.length > 0 && (
        <PostalTable receipts={receipts} extractStates={extractStates} />
      )}

      {/*
        대장 — 이 화면의 주인공. 예전에는 영수증 목록이 이 자리를 차지했고
        대장은 엑셀에만 있어, 발송이 제대로 기록됐는지 화면에서 볼 수 없었다.
      */}
      {ledger.error ? (
        // 못 읽은 이유를 그대로 보여준다 — 빈 표는 "발송이 없다"로 읽힌다.
        <p className="text-xs text-vermilion-deep">{ledger.error}</p>
      ) : (
        <LedgerTable
          rows={ledger.rows}
          receiptUrls={ledger.receiptUrls}
          ledgerUrl={ledgerUrl}
          years={ledger.years}
          year={ledger.year}
        />
      )}
    </div>
  );
}
