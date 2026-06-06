import type {
  SmileEdiRow,
  SmileEdiMappingConfig,
  SmileEdiGrouping,
} from "./types";
import { resolveManager } from "./manager-rules";

/**
 * 필터된 행을 담당자별로 그룹핑. 담당자명은 resolveManager로 결정하고
 * 수신 이메일(managerEmail 매핑)이 없는 담당자는 발송 불가로 분리(unresolvedManagers).
 * service-notice/grouping.ts의 Map 누적 패턴 차용.
 */
export function groupByManager(
  rows: SmileEdiRow[],
  config: SmileEdiMappingConfig,
): SmileEdiGrouping {
  const byManager = new Map<
    string,
    { rows: SmileEdiRow[]; routedByDefault: boolean }
  >();

  for (const row of rows) {
    const { managerName, routedByDefault } = resolveManager(row, config);
    const entry = byManager.get(managerName) ?? {
      rows: [],
      routedByDefault: false,
    };
    entry.rows.push(row);
    if (routedByDefault) entry.routedByDefault = true;
    byManager.set(managerName, entry);
  }

  const groups: SmileEdiGrouping["groups"] = [];
  const unresolvedManagers: SmileEdiGrouping["unresolvedManagers"] = [];

  for (const [managerName, { rows: managerRows, routedByDefault }] of byManager) {
    const recipientEmail = config.managerEmail[managerName];
    if (!recipientEmail) {
      unresolvedManagers.push({
        managerName,
        companyNames: [...new Set(managerRows.map((r) => r.companyName))],
      });
      continue;
    }
    groups.push({ managerName, recipientEmail, rows: managerRows, routedByDefault });
  }

  return { groups, unresolvedManagers };
}
