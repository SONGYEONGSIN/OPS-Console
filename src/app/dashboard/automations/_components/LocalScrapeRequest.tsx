"use client";

import { useActionState } from "react";
import { requestLocalScrapeAction } from "@/features/closing/scrape-requests/actions";
import type {
  ScrapeRequest,
  ScrapeRequestStatus,
} from "@/features/closing/scrape-requests/schemas";

const ADMIN_ONLY_MSG = "관리자만 실행 가능합니다.";

const STATUS_LABEL: Record<ScrapeRequestStatus, string> = {
  pending: "대기 중",
  running: "실행 중",
  done: "완료",
  failed: "실패",
};

/**
 * 서비스 마감 '로컬 수동 실행' 행 — 자동화 테이블(AutomationHub) tbody 안에 렌더.
 * 컬럼 구성을 AutomationRow와 동일하게 맞춘다(자동화 / 스케줄·최근요청 / 자동실행 / 수동실행).
 */
export function LocalScrapeRequest({
  latest,
  isAdmin,
}: {
  latest: ScrapeRequest | null;
  isAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    requestLocalScrapeAction,
    undefined,
  );

  return (
    <tr className="border-b border-line align-top">
      <td className="px-3 py-3">
        <div className="font-semibold text-ink">
          서비스 마감 — 로컬 수동 실행
        </div>
        <div className="mt-0.5 whitespace-pre-line text-xs leading-[1.5] text-muted">
          웹·GitHub Actions는 Cloudflare 차단으로 직접 실행 불가. 요청하면 회사
          PC 폴러가 감지해 실행합니다(최대 5분).
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-muted">
        <div>회사 PC 폴러 · 5분 간격</div>
        <div className="mt-0.5">
          {latest
            ? `최근 요청 ${STATUS_LABEL[latest.status]} · ${new Date(
                latest.requested_at,
              ).toLocaleString("ko-KR")}`
            : "요청 기록 없음"}
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-muted">—</td>
      <td className="px-3 py-3">
        <div className="flex flex-col items-start gap-1">
          <form
            action={formAction}
            onSubmit={(e) => {
              if (!isAdmin) {
                e.preventDefault();
                alert(ADMIN_ONLY_MSG);
              }
            }}
          >
            <button
              type="submit"
              disabled={pending}
              className="inline-flex w-fit items-center border border-vermilion bg-vermilion cursor-pointer px-3 py-1 text-xs font-medium text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "요청 중…" : "로컬 실행"}
            </button>
          </form>
          {state ? (
            <span
              className={`text-xs ${state.ok ? "text-ink" : "text-vermilion"}`}
            >
              {state.message}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
