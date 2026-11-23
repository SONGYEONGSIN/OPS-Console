import { kept, type AutoSnapshot } from "@/features/ops-weekly/merge";
import type { ReportDetail } from "@/features/ops-weekly/report-queries";
import type { PanelArea } from "./_params";

export type AreaCount = { auto: number; direct: number };

/**
 * 영역 탭 제목 줄의 `자동 n건 · 직접 n건` — 탭 제목과 제출 탭 요약이 이 한 곳을 쓴다(둘이 갈리면 안 된다).
 * 뺀 건은 세지 않는다(kept). 원서접수는 구분 수집 전이면 개발·테스트·미확인을 빼고 센다(탭에 안 보이므로).
 */
export function areaCounts(
  snapshot: AutoSnapshot,
  detail: ReportDetail,
): Record<PanelArea, AreaCount> {
  const app = snapshot.application;
  const appLists = [
    ...(app.devStatusCollected ? [app.dev, app.test, app.unknown] : []),
    app.opening,
    app.running,
    app.closing,
  ];
  const direct = (area: PanelArea) =>
    detail.manual.filter((m) => m.area === area).length;
  return {
    application: {
      auto: appLists.reduce((n, l) => n + kept(l, detail.overrides), 0),
      direct: direct("application"),
    },
    pims: {
      auto:
        kept(snapshot.pims.thisWeek, detail.overrides) +
        kept(snapshot.pims.nextWeek, detail.overrides),
      direct: direct("pims"),
    },
    leave: {
      // 휴가·외근 탭은 뺀 건도 행으로 남겨 센다 — 탭 제목과 같게.
      auto: snapshot.leave.length,
      direct: direct("leave"),
    },
  };
}

export const countLabel = (c: AreaCount) =>
  `자동 ${c.auto}건 · 직접 ${c.direct}건`;
