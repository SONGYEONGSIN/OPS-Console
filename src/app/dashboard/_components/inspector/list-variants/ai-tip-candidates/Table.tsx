"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import { statusBadgeTone } from "../badge-tone";
import { kstFormat } from "@/lib/kst-format";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

/** 수집일 — 날짜만. 시각까지는 후보를 훑는 데 짐만 된다. */
const COLLECTED_DATE = kstFormat({
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatCollectedAt(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  // 화면에 `Invalid Date` 를 흘리지 않는다.
  if (Number.isNaN(d.getTime())) return "—";
  return COLLECTED_DATE.format(d);
}

const REVIEW_LABEL: Record<
  NonNullable<ListRow["tipCandidateStatus"]>,
  string
> = {
  pending: "검토 대기",
  promoted: "등록완료",
  hidden: "숨김",
};

export function AiTipCandidateTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">제목</th>
          <th className="px-3 py-2">리포지터리</th>
          <th className="px-3 py-2">별</th>
          <th className="px-3 py-2">수집일</th>
          <th className="px-3 py-2">검토</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-center text-muted">
              수집된 후보 없음
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const review = row.tipCandidateStatus;
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-line-soft align-top hover:bg-line-soft ${
                  selectedId === row.id ? "bg-vermilion/10" : ""
                }`}
              >
                <td className="px-3 py-2">
                  {row.name ? (
                    <>
                      <p className="font-medium text-ink">{row.name}</p>
                      {row.summary && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                          {row.summary}
                        </p>
                      )}
                    </>
                  ) : (
                    // 빈칸으로 두면 왜 비었는지 모른다 — claude 초안이 없었다는 뜻이다.
                    <span className="text-xs text-muted">
                      초안 없음 — 등록 후 직접 작성
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-sm">
                  {row.tipCandidateRepoUrl ? (
                    <a
                      href={row.tipCandidateRepoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      // 링크를 눌렀을 때까지 인스펙터가 열리면 새 탭 뒤에 엉뚱한 게 남는다.
                      onClick={(e) => e.stopPropagation()}
                      className="text-vermilion underline-offset-2 hover:underline"
                    >
                      {row.tipCandidateRepoFullName}
                    </a>
                  ) : (
                    <span className="text-ink">
                      {row.tipCandidateRepoFullName}
                    </span>
                  )}
                  {row.tipCandidateRepoDescription && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                      {row.tipCandidateRepoDescription}
                    </p>
                  )}
                </td>
                {/* 별은 세는 값이라 tabular-nums — font-mono 는 식별자 전용. */}
                <td className="px-3 py-2 text-xs tabular-nums text-ink-soft">
                  {row.tipCandidateStars ?? 0}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {formatCollectedAt(row.tipCandidateCollectedAt)}
                </td>
                <td className="px-3 py-2">
                  {review && (
                    <span
                      className={`inline-block px-2 py-0.5 text-2xs ${statusBadgeTone(
                        REVIEW_LABEL[review],
                      )}`}
                    >
                      {REVIEW_LABEL[review]}
                    </span>
                  )}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
