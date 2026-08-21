"use client";

import { kstFormat } from "@/lib/kst-format";
import { useMemo, useState, useTransition } from "react";
import { ListSearch } from "@/components/common/ListSearch";
import { ModalShell } from "@/components/common/ModalShell";
import type { ReceiptCard, ExtractState } from "@/features/postal/queries";
import { ReceiptReview, ConfirmButton } from "./ReceiptReview";
import { formatAcceptedAt } from "@/features/postal/accepted-at";
import type { ReviewRow } from "@/features/postal/review-rows";
import { deleteReceipt } from "@/features/postal/actions";

/**
 * 올린 영수증 목록 — 확정한 것도 남는다(검토 대기만이 아니다).
 *
 * 탭이 '등기관리', 대장이 '발송목록'이 되면서 이 표만 '등기내역'으로 남아
 * 무엇이 등기 내역인지 흐려졌다. 하는 일 그대로 '영수증'이라 부른다(2026-08-20).
 *
 * 우편물 영수증 목록 — 운영리포트의 '저장된 리포트'와 같은 톤(thead + hover row).
 *
 * 카드 격자였는데 여러 건을 훑기 어려웠다. 표로 바꾸고, 원본은 행을 눌러 팝업으로
 * 본다 — 목록에 사진을 늘어놓으면 정작 등기번호·금액이 안 보인다.
 */

const EMPTY: ExtractState = {
  status: "none",
  warnings: [],
  message: null,
  acceptedAt: null,
  rows: [],
};

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

function fmtDate(iso: string): string {
  return kstFormat({
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** 메일 주소를 그대로 두면 열이 넓어진다 — 앞부분만 보여준다. */
const shortName = (email: string) => email.split("@")[0] ?? email;

export function PostalTable({
  receipts,
  extractStates,
}: {
  receipts: ReceiptCard[];
  extractStates: Record<string, ExtractState>;
}) {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return receipts
      .map((r) => ({ receipt: r, extract: extractStates[r.id] ?? EMPTY }))
      .filter(({ receipt, extract }) => {
        if (!needle) return true;
        // 사람이 들고 오는 번호가 등기번호라 그것도 찾을 수 있어야 한다.
        const hay = [
          receipt.uploadedBy,
          receipt.createdAt,
          extract.acceptedAt ?? "",
          ...extract.rows.map((x) => `${x.trackingNo} ${x.recipientOrg ?? ""} ${x.recipientName ?? ""}`),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
  }, [receipts, extractStates, q]);

  // 서명 만료로 이미지가 안 열린 경우. 다른 영수증을 열면 초기화된다.
  const [brokenId, setBrokenId] = useState<string | null>(null);
  const opened = receipts.find((r) => r.id === openId) ?? null;
  const imageBroken = brokenId !== null && brokenId === openId;

  return (
    <div className="flex flex-col gap-3">
      {/* 검색은 목록 위 별도 줄(다른 메뉴의 controlsRow 자리). 검색 앞에 제목을
          붙이지 않는다 — 표준은 제목이 그 아래 헤더에 있다. */}
      <ListSearch
        value={q}
        onChange={setQ}
        ariaLabel="우편물 검색"
        placeholder="올린 사람·날짜·등기번호·수취인 검색"
      />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-xl font-bold text-ink">영수증</h3>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <span className="text-sm text-vermilion">{rows.length}건</span>
        </div>
      </header>

      {/* 표가 좁은 화면보다 넓으면 가로로 밀어서 본다. ListPattern 이 변형표를
          감싸주는 것과 같은 처리인데 이 표만 맨몸이라 모바일에서 잘렸다.
          min-w-0 이 없으면 flex 자식이 내용 너비만큼 벌어져 스크롤이 안 생긴다. */}
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
              <th className="px-3 py-2">올린 날</th>
              <th className="px-3 py-2">올린 사람</th>
              <th className="px-3 py-2">접수일시</th>
              <th className="px-3 py-2">등기</th>
              <th className="px-3 py-2">금액</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ receipt, extract }) => {
              const total = extract.rows.reduce((a, x) => a + (x.fee ?? 0), 0);
              return (
                <RowPair
                  key={receipt.id}
                  receipt={receipt}
                  extract={extract}
                  total={total}
                  onOpen={() => setOpenId(receipt.id)}
                />
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="border-b border-line-soft px-3 py-10 text-sm text-muted"
                >
                  {/* 한 건도 없는 것과 검색에 안 걸린 것은 다른 말이다.
                      전자는 무엇을 하면 되는지 알려주고, 후자는 검색어를 되짚게 한다. */}
                  {receipts.length === 0
                    ? "올린 영수증이 없습니다. 위 칸에 영수증을 끌어다 놓으세요."
                    : "찾는 영수증이 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {opened && (
        <ModalShell
          title={`영수증 — ${fmtDate(opened.createdAt)}`}
          onClose={() => setOpenId(null)}
          size="a4"
        >
          {opened.imageUrl && !imageBroken ? (
            // 세로로 긴 영수증이라 폭에 맞추고 높이는 화면을 넘지 않게 자른다.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={opened.imageUrl}
              alt={`영수증 원본 (${fmtDate(opened.createdAt)})`}
              className="mx-auto max-h-[70vh] w-auto object-contain"
              // 서명 URL 은 5분이라 목록을 열어둔 채 나중에 누르면 죽는다.
              // 그냥 두면 깨진 아이콘만 남아 무엇이 잘못됐는지 알 수 없다.
              onError={() => setBrokenId(openId)}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted">
              지금은 열 수 없습니다 — 화면을 새로 고치면 다시 열립니다
            </p>
          )}
        </ModalShell>
      )}
    </div>
  );
}

/**
 * 한 영수증 = 목록 행 + (판독됐으면) 그 아래 검토 표.
 *
 * 검토 표를 팝업에 넣지 않는다 — 고치면서 원본을 봐야 하는데 둘 다 팝업이면
 * 겹친다. 목록에서 펼쳐 두고 원본만 띄운다.
 */
/**
 * 잘못 올린 영수증 지우기.
 *
 * 행을 누르면 원본 팝업이 열리므로 클릭이 새어나가지 않게 막는다.
 */
function DeleteButton({ receipt }: { receipt: ReceiptCard }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          if (
            !window.confirm(
              "이 영수증을 삭제하시겠습니까? 판독 결과도 함께 사라지며 되돌릴 수 없습니다.",
            )
          ) {
            return;
          }
          startTransition(async () => {
            const r = await deleteReceipt(receipt.id);
            if (!r.ok) setError(r.error);
          });
        }}
        className="cursor-pointer border border-line-soft px-2 py-0.5 text-xs text-muted transition-colors hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "삭제 중" : "삭제"}
      </button>
      {error && <p className="mt-1 text-2xs text-vermilion">{error}</p>}
    </>
  );
}

function RowPair({
  receipt,
  extract,
  total,
  onOpen,
}: {
  receipt: ReceiptCard;
  extract: ExtractState;
  total: number;
  onOpen: () => void;
}) {
  // 검토표에서 고친 값. 확정 버튼이 영수증 행에 있어(삭제와 나란히) 여기서 들고
  // 검토표와 주고받는다 — 두 곳이 같은 값을 봐야 고친 대로 확정된다.
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>(extract.rows);

  return (
    <>
      <tr
        onClick={onOpen}
        className="cursor-pointer border-b border-line-soft hover:bg-line-soft"
      >
        <td className="px-3 py-2 text-sm text-ink-soft">
          {fmtDate(receipt.createdAt)}
        </td>
        <td className="px-3 py-2 text-sm text-ink">
          {shortName(receipt.uploadedBy)}
        </td>
        <td className="px-3 py-2 text-sm text-ink-soft">
          {formatAcceptedAt(extract.acceptedAt)}
        </td>
        <td className="px-3 py-2 text-sm tabular-nums text-ink-soft">
          {extract.rows.length > 0 ? `${extract.rows.length}건` : "—"}
        </td>
        <td className="px-3 py-2 text-sm tabular-nums text-ink">
          {total > 0 ? won(total) : "—"}
        </td>
        <td className="px-3 py-2 text-sm">
          {receipt.confirmedAt ? (
            <span className="inline-block bg-vermilion/10 px-2 py-0.5 text-xs text-vermilion">
              확정
            </span>
          ) : (
            <span className="inline-block bg-line-soft px-2 py-0.5 text-xs text-muted">
              {extract.status === "done" ? "검토 대기" : "판독 전"}
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          {/*
            확정건에는 아예 안 보여준다 — 눌렀다가 거절당하는 것보다 낫다.
            확정과 삭제는 같은 영수증에 대한 두 결정이라 나란히 둔다(2026-08-21).
          */}
          {!receipt.confirmedAt && (
            <span className="inline-flex items-center gap-2">
              {extract.status === "done" && (
                <ConfirmButton
                  receiptId={receipt.id}
                  acceptedAt={extract.acceptedAt}
                  rows={reviewRows}
                />
              )}
              <DeleteButton receipt={receipt} />
            </span>
          )}
        </td>
      </tr>
      {/* 확정하면 검토 표를 접는다.
          검토는 '고칠 것이 있나' 보는 자리다. 확정하면 그 일은 끝났고 내용은
          등기대장 탭에 남는다. 그대로 펼쳐 두면 아직 할 일이 있는 것처럼 보이고,
          고쳐도 아무 일이 안 일어나 사람을 헷갈리게 한다. */}
      {!receipt.confirmedAt && (
        <tr>
          {/* 위쪽 여백을 준다 — 영수증 행에 검토 표 머리가 바로 붙으면
              어느 줄이 목록이고 어느 줄이 그 안쪽인지 구분이 안 된다. */}
          <td colSpan={7} className="px-3 pt-4 pb-6">
            <ReceiptReview
              receiptId={receipt.id}
              state={extract}
              rows={reviewRows}
              onRowsChange={setReviewRows}
            />
            </td>
        </tr>
      )}
    </>
  );
}
