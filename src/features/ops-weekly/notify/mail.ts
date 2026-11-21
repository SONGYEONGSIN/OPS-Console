// 주간업무보고 알림 문구 — 순수 함수. 인라인 스타일만(Outlook 규칙, manual-review/mail.ts 와 같은 이유).

import { escapeHtml } from "@/features/receivables/mail-template";
import { OPS_WEEKLY_PATH } from "../constants";

export type NoticeWeek = { weekStart: string; label: string; rangeLabel: string };
export type Mail = { subject: string; html: string };

const BRAND = "[운영부 상황실]";
const FONT = "font-family:'Malgun Gothic','맑은 고딕',Arial,sans-serif;";
const TEXT = `${FONT}font-size:14px;`;
const NOTE = `${FONT}font-size:12px;color:#888;`;
const BUTTON = `${FONT}font-size:14px;font-weight:bold;color:#ffffff;background:#c8442f;padding:8px 16px;text-decoration:none;display:inline-block;`;
const FOOTER = "이 메일은 운영부 상황실이 자동으로 보냈습니다.";

/** 주는 늘 고정한다 — 메일을 늦게 열어도 그 주가 열린다. */
export function opsWeeklyLink(
  base: string,
  weekStart: string,
  view: "all" | "status" | null = null,
): string {
  const url = `${base.replace(/\/+$/, "")}${OPS_WEEKLY_PATH}?week=${weekStart}`;
  if (view === "all") return `${url}&op=all`;
  if (view === "status") return `${url}&tab=status`;
  return url;
}

const p = (text: string, style = TEXT) => `<p style="${style}">${text}</p>`;
const button = (href: string, label: string) =>
  `<p><a href="${escapeHtml(href)}" style="${BUTTON}">${label}</a></p>`;
const wrap = (inner: string) =>
  `<div style="color:#222;">\n${inner}\n${p(FOOTER, NOTE)}\n</div>`;
const head = (w: NoticeWeek) => `${w.label} (${w.rangeLabel})`;

export function requestMail(w: NoticeWeek, base: string): Mail {
  return {
    subject: `${BRAND} ${w.label} 주간업무보고 작성 요청`,
    html: wrap(
      [
        p(`${head(w)} 주간업무보고 작성을 시작해 주세요.`),
        p("자동으로 채워진 목록을 확인하고 특이사항을 적은 뒤 <b>제출완료</b>를 누르면 됩니다. 목요일 17:00 까지 부탁드립니다."),
        button(opsWeeklyLink(base, w.weekStart), "작성하러 가기"),
      ].join("\n"),
    ),
  };
}

export function remindMail(w: NoticeWeek, base: string): Mail {
  return {
    subject: `${BRAND} ${w.label} 주간업무보고 — 아직 제출하지 않았습니다`,
    html: wrap(
      [
        p(`${head(w)} 주간업무보고를 아직 제출하지 않았습니다.`),
        p("내용을 확인한 뒤 <b>제출완료</b>를 눌러 주세요. 전원이 제출해야 당번이 보고할 수 있습니다."),
        button(opsWeeklyLink(base, w.weekStart), "제출하러 가기"),
      ].join("\n"),
    ),
  };
}

export function allSubmittedMail(w: NoticeWeek, base: string): Mail {
  return {
    subject: `${BRAND} ${w.label} 주간업무보고 — 전원 제출`,
    html: wrap(
      [
        p(`${head(w)} 주간업무보고가 모두 제출됐습니다.`),
        p("이번 주 당번입니다 — 내용을 검토하고 주요 요약을 적은 뒤 <b>최종 보고</b>를 눌러 주세요."),
        button(opsWeeklyLink(base, w.weekStart, "status"), "제출 현황 보기"),
      ].join("\n"),
    ),
  };
}

export function returnedMail(
  w: NoticeWeek,
  base: string,
  args: { reason: string | null; by: string },
): Mail {
  const reason = args.reason?.trim();
  return {
    subject: `${BRAND} ${w.label} 주간업무보고 — 다시 작성 요청`,
    html: wrap(
      [
        p(`${escapeHtml(args.by)} 님이 ${head(w)} 주간업무보고를 다시 작성해 달라고 요청했습니다.`),
        ...(reason ? [p(`사유: ${escapeHtml(reason)}`)] : []),
        p("고친 뒤 다시 <b>제출완료</b>를 눌러 주세요."),
        button(opsWeeklyLink(base, w.weekStart), "고치러 가기"),
      ].join("\n"),
    ),
  };
}

export function reportedMail(
  w: NoticeWeek,
  base: string,
  args: { by: string },
): Mail {
  return {
    subject: `${BRAND} ${w.label} 운영부 주간업무보고`,
    html: wrap(
      [
        p(`${head(w)} 운영부 주간업무보고입니다.`),
        p(`이번 주 당번 ${escapeHtml(args.by)} 님이 운영1·2팀 보고를 모아 최종 보고했습니다.`),
        button(opsWeeklyLink(base, w.weekStart, "all"), "보고서 보기"),
      ].join("\n"),
    ),
  };
}

/** Teams 그룹채팅 — 메일보다 짧게, 한 문단 + 링크. */
export function requestTeamsHtml(w: NoticeWeek, base: string): string {
  const href = escapeHtml(opsWeeklyLink(base, w.weekStart));
  return `<p><b>${BRAND} ${w.label} 주간업무보고</b> 작성을 시작해 주세요. 목요일 17:00 까지 제출 부탁드립니다.</p><p><a href="${href}">작성하러 가기</a></p>`;
}
