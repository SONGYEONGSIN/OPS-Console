// 작성 명단·당번 순번·수신자 경고 — 순수 함수.

import { floorMod } from "@/features/automations/jobs/weekly-report/rollover-logic";
import { canViewMenu } from "@/features/auth/permission";
import type { OperatorPermission } from "@/features/operators/schemas";
import {
  EXCLUDED_WRITER_ROLES,
  OPS_WEEKLY_SLUG,
  WRITER_TEAMS,
} from "./constants";
import type { RecipientWarning } from "./recipient-warning";
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

/**
 * 작성 대상 = 운영1·2팀 · 활성 · 부장/팀장 제외 · 제외 목록 제외.
 * 부장·팀장도 작성 포함 목록(includedEmails)에 있으면 대상이다 — 직급을 바꾸지 않고 예외로 넣는다.
 * 제외 목록이 포함보다 앞선다.
 */
export function writerRoster(
  rows: readonly WriterCandidate[],
  excludedEmails: readonly string[],
  includedEmails: readonly string[] = [],
): WriterCandidate[] {
  const excluded = new Set(excludedEmails);
  const included = new Set(includedEmails);
  return rows
    .filter(
      (r) =>
        WRITER_TEAM_SET.has(r.team) &&
        r.status === "active" &&
        (!EXCLUDED_ROLE_SET.has(r.role) || included.has(r.email)) &&
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

export {
  RECIPIENT_WARNING_LABEL,
  type RecipientWarning,
} from "./recipient-warning";

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
