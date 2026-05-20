import "server-only";
import { listIncidents } from "@/features/incidents/queries";
import { listHandoverProgress } from "@/features/handover/progress-queries";
import { listWorklog } from "@/features/worklog/queries";

export type OpsAlertTone = "urgent" | "review" | "ok";

export type OpsAlert = {
  id: string;
  tone: OpsAlertTone;
  /** 분류 라벨 (사고 / 인수인계 / 활동) */
  category: string;
  /** 본문 */
  label: string;
  /** 우측 시각/보조 */
  time: string;
  /** 클릭 시 이동 경로 */
  href: string;
};

function isToday(iso: string): boolean {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
  }).format(new Date());
  const target = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
  }).format(new Date(iso));
  return today === target;
}

/** 간략 시각 — 오늘이면 HH:mm, 그 외엔 M.D */
function hm(iso: string): string {
  if (isToday(iso)) {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  }
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  }).format(new Date(iso));
}

/**
 * 운영 알림 종합 — chrome 종 아이콘.
 * 1) 신규 사고 (오늘=urgent, 그 외=review)
 * 2) 본인 수신 인수인계 (to_email=me, in_progress=review)
 * 3) 본인 최근 활동 (worklog, ok)
 * created_at desc 통합, urgent 우선 정렬.
 */
export async function getOpsAlerts(
  currentUserEmail: string | null,
): Promise<OpsAlert[]> {
  const [incidentsRes, progressRes, worklogRes] = await Promise.all([
    listIncidents({ pageSize: 5 }),
    currentUserEmail
      ? listHandoverProgress({ toEmail: currentUserEmail })
      : Promise.resolve({ rows: [], total: 0 }),
    currentUserEmail
      ? listWorklog({ pageSize: 5, userEmail: currentUserEmail })
      : Promise.resolve({ rows: [], total: 0 }),
  ]);

  const alerts: OpsAlert[] = [];

  for (const i of incidentsRes.rows) {
    const created = i.created_at;
    alerts.push({
      id: `incident-${i.id}`,
      tone: isToday(created) ? "urgent" : "review",
      category: "사고",
      label: i.title,
      time: hm(created),
      href: "/dashboard/incidents",
    });
  }

  for (const p of progressRes.rows) {
    if (p.status !== "in_progress") continue;
    alerts.push({
      id: `handover-${p.id}`,
      tone: "review",
      category: "인수인계 수신",
      label: `${p.university_name} · ${p.service_name} (${p.from_name})`,
      time: hm(p.created_at),
      href: "/dashboard/handover?tab=history",
    });
  }

  for (const w of worklogRes.rows) {
    alerts.push({
      id: `worklog-${w.id}`,
      tone: w.level === "ERROR" ? "urgent" : "ok",
      category: "활동",
      label: w.msg,
      time: hm(w.created_at),
      href: "/dashboard/worklog",
    });
  }

  // urgent → review → ok, 같은 tone 내 최신순
  const order: Record<OpsAlertTone, number> = { urgent: 0, review: 1, ok: 2 };
  alerts.sort((a, b) => order[a.tone] - order[b.tone]);
  return alerts.slice(0, 12);
}
