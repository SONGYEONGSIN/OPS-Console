// 작성 명단·당번 순번·수신자 경고 — 순수 함수.

import { floorMod } from "@/features/automations/jobs/weekly-report/rollover-logic";
import { canViewMenu } from "@/features/auth/permission";
import type { OperatorPermission } from "@/features/operators/schemas";
import {
  EXCLUDED_WRITER_ROLES,
  OPS_WEEKLY_SLUG,
  WRITER_TEAMS,
} from "./constants";
import { weeksBetween } from "./week";

export type WriterCandidate = {
  email: string;
  name: string;
  team: string;
  role: string;
  status: string;
};

const WRITER_TEAM_SET: ReadonlySet<string> = new Set(WRITER_TEAMS);
const EXCLUDED_ROLE_SET: ReadonlySet<string> = new Set(EXCLUDED_WRITER_ROLES);

export function writerRoster(
  rows: readonly WriterCandidate[],
  excludedEmails: readonly string[],
): WriterCandidate[] {
  const excluded = new Set(excludedEmails);
  return rows
    .filter(
      (r) =>
        WRITER_TEAM_SET.has(r.team) &&
        r.status === "active" &&
        !EXCLUDED_ROLE_SET.has(r.role) &&
        !excluded.has(r.email),
    )
    .map((r) => ({ ...r, name: r.name.trim() }));
}

export function dutyForWeek(
  weekStart: string,
  rotation: readonly string[],
  anchorWeekStart: string | null,
): string | null {
  if (rotation.length === 0 || anchorWeekStart === null) return null;
  return rotation[
    floorMod(weeksBetween(anchorWeekStart, weekStart), rotation.length)
  ];
}

export type RecipientWarning = "not-operator" | "inactive" | "no-menu";

export const RECIPIENT_WARNING_LABEL: Record<RecipientWarning, string> = {
  "not-operator": "운영자 명단에 없음",
  inactive: "비활성 계정",
  "no-menu": "메뉴 권한 없음",
};

export type RecipientOperator = {
  email: string;
  status: string;
  permission: OperatorPermission | null;
  allowed_menus: string[];
};

export function recipientWarning(
  op: RecipientOperator | null,
): RecipientWarning | null {
  if (op === null) return "not-operator";
  if (op.status !== "active") return "inactive";
  const canView = canViewMenu(OPS_WEEKLY_SLUG, {
    email: op.email,
    operator: null,
    displayName: "",
    role: "",
    team: null,
    permission: op.permission,
    allowedMenus: op.allowed_menus,
  });
  return canView ? null : "no-menu";
}
