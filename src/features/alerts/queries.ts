import "server-only";
import { listIncidents } from "@/features/incidents/queries";
import { listHandoverProgress } from "@/features/handover/progress-queries";
import { listServices } from "@/features/services/queries";
import { listMyTodos } from "@/features/todos/queries";
import { listBackupRequests } from "@/features/backup-requests/queries";
import { listContracts } from "@/features/contracts/queries";
import { fetchReceivablesSheet } from "@/features/receivables/queries";
import {
  receivablesToListRow,
  isReceivablesDataRow,
} from "@/app/dashboard/receivables/_row-mapper";

export type OpsAlertTone = "urgent" | "review" | "ok";

export type OpsAlert = {
  id: string;
  tone: OpsAlertTone;
  /** 분류 라벨 (사고 / 인수인계 수신 / 오픈 예정 / 내 할 일 / 백업 요청 / 계약 / 미수채권) */
  category: string;
  /** 본문 */
  label: string;
  /** 우측 시각/보조 */
  time: string;
  /** 클릭 시 이동 경로 */
  href: string;
};

const KST_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
});

function todayYmd(): string {
  return KST_DATE_FMT.format(new Date());
}

function isToday(iso: string): boolean {
  return todayYmd() === KST_DATE_FMT.format(new Date(iso));
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

/** 오늘(KST 자정) 기준 D-N. null 불가, 과거면 음수. */
function daysUntilKst(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const todayStr = todayYmd();
  const today = new Date(`${todayStr}T00:00:00+09:00`);
  const targetYmd = KST_DATE_FMT.format(target);
  const targetMidnight = new Date(`${targetYmd}T00:00:00+09:00`);
  return Math.round(
    (targetMidnight.getTime() - today.getTime()) / 86400000,
  );
}

/**
 * 운영 알림 종합 — chrome 종 아이콘.
 * 7 도메인 소스를 합쳐 단일 dropdown에 노출:
 * 1) 사고 (오늘=urgent, 그 외=review)
 * 2) 인수인계 수신 (본인 to_email, in_progress=review)
 * 3) 오픈 예정 서비스 (write_start_at D-7=urgent, D-14=review)
 * 4) 내 할 일 (due_at 오늘=urgent, D-3=review — 본인 todo)
 * 5) 백업 요청 (leave_start_date D-3=urgent, D-7=review)
 * 6) 계약 (status가 '체결완료'/'계약완료' 외 모두 review)
 * 7) 미수채권 (status=active 미입금 모두 review)
 *
 * urgent → review → ok 순 정렬, 최대 30건.
 */
export async function getOpsAlerts(
  currentUserEmail: string | null,
): Promise<OpsAlert[]> {
  const [
    incidentsRes,
    progressRes,
    servicesRes,
    todos,
    backupsRes,
    contractsRes,
    receivablesSheet,
  ] = await Promise.all([
    listIncidents({ pageSize: 5 }),
    currentUserEmail
      ? listHandoverProgress({ toEmail: currentUserEmail })
      : Promise.resolve({ rows: [], total: 0 }),
    listServices({ pageSize: 2000, sort: "service_id_asc" }),
    listMyTodos(),
    listBackupRequests({ pageSize: 1000 }),
    listContracts().catch(() => ({ rows: [], total: 0 })),
    fetchReceivablesSheet().catch(() => null),
  ]);

  const alerts: OpsAlert[] = [];

  // 1) 사고
  for (const i of incidentsRes.rows) {
    alerts.push({
      id: `incident-${i.id}`,
      tone: isToday(i.created_at) ? "urgent" : "review",
      category: "사고",
      label: i.title,
      time: hm(i.created_at),
      href: "/dashboard/incidents",
    });
  }

  // 2) 인수인계 수신 (본인 한정)
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

  // 3) 오픈 예정 서비스 (전체, D-14 이내)
  for (const s of servicesRes.rows) {
    const d = daysUntilKst(s.write_start_at);
    if (d === null || d < 0 || d > 14) continue;
    alerts.push({
      id: `service-${s.id}`,
      tone: d <= 7 ? "urgent" : "review",
      category: "오픈 예정",
      label: `${s.university_name} · ${s.service_name}`,
      time: d === 0 ? "오늘 오픈" : `D-${d}`,
      href: "/dashboard/services",
    });
  }

  // 4) 내 할 일 (마감 임박 D-3 이내, 본인 한정 — listMyTodos가 자체 필터)
  for (const t of todos) {
    if (t.done) continue;
    if (!t.due_at) continue;
    const d = daysUntilKst(t.due_at);
    if (d === null || d < 0 || d > 3) continue;
    alerts.push({
      id: `todo-${t.id}`,
      tone: d === 0 ? "urgent" : "review",
      category: "내 할 일",
      label: t.title,
      time: d === 0 ? "오늘 마감" : `D-${d}`,
      href: "/dashboard/my-todo",
    });
  }

  // 5) 백업 요청 (전체, leave_start_date D-7 이내)
  for (const b of backupsRes.rows) {
    const d = daysUntilKst(b.leave_start_date);
    if (d === null || d < 0 || d > 7) continue;
    const label =
      b.leave_start_date && b.leave_end_date
        ? `${b.leave_start_date} ~ ${b.leave_end_date} 백업`
        : b.summary_md.slice(0, 30);
    alerts.push({
      id: `backup-${b.id}`,
      tone: d <= 3 ? "urgent" : "review",
      category: "백업 요청",
      label,
      time: d === 0 ? "오늘 시작" : `D-${d}`,
      href: "/dashboard/backup",
    });
  }

  // 6) 계약 (status가 '체결완료'/'계약완료' 외 모두 review)
  for (const c of contractsRes.rows) {
    const status = (c.status ?? "").trim();
    if (status === "체결완료" || status === "계약완료") continue;
    alerts.push({
      id: `contract-${c.sheet}-${c.numbering}`,
      tone: "review",
      category: "계약",
      label: `${c.name} (${c.numbering || "-"})`,
      time: status || "미체결",
      href: "/dashboard/contracts",
    });
  }

  // 7) 미수채권 (active=미입금 모두 review)
  if (receivablesSheet) {
    const allRows = receivablesSheet.rows
      .map((_, i) => receivablesToListRow(receivablesSheet, i))
      .filter(isReceivablesDataRow);
    for (const r of allRows) {
      if (r.status !== "active") continue;
      alerts.push({
        id: `receivables-${r.id}`,
        tone: "review",
        category: "미수채권",
        label: `${r.name} · ${r.body ?? "-"}`,
        time: r.meta ?? "미입금",
        href: "/dashboard/receivables",
      });
    }
  }

  // urgent → review → ok 순
  const order: Record<OpsAlertTone, number> = { urgent: 0, review: 1, ok: 2 };
  alerts.sort((a, b) => order[a.tone] - order[b.tone]);
  return alerts.slice(0, 30);
}
