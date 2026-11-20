import type { AutoItem } from "@/features/ops-weekly/auto-lists/application";
import {
  applyOverrides,
  computeKpis,
  kept,
  manualCount,
  type AutoSnapshot,
} from "@/features/ops-weekly/merge";
import type { ReportDetail } from "@/features/ops-weekly/report-queries";
import { APP_GROUP_TITLE, appSubStateOf } from "../_groups";
import { defaultAppSub } from "../_params";
import { AutoGroupSection } from "./AutoGroupSection";
import { AutoFreezeNotice } from "./AutoFreezeNotice";
import { SubTabs, type SubTabItem } from "./SubTabs";
import { TabHeading } from "./TabHeading";
import { UnmatchedNotice } from "./UnmatchedNotice";

type Props = {
  snapshot: AutoSnapshot;
  detail: ReportDetail;
  reportId: string | null;
  editable: boolean;
  freezeNotice: boolean;
  /** 안 붙은 서비스 안내는 관리자에게만 보인다 */
  isAdmin: boolean;
  /** 설정 탭의 안 붙은 서비스 패널 주소 */
  settingsHref: string;
};

type StageKey = "dev" | "test";
const STAGES: readonly { key: StageKey; title: string }[] = [
  { key: "dev", title: APP_GROUP_TITLE.dev },
  { key: "test", title: APP_GROUP_TITLE.test },
];
const AFTER: readonly {
  key: "running" | "opening" | "closing";
  title: string;
}[] = [
  { key: "running", title: APP_GROUP_TITLE.running },
  { key: "opening", title: APP_GROUP_TITLE.opening },
  { key: "closing", title: APP_GROUP_TITLE.closing },
];

/** 원서접수 탭 — 개발·테스트·운영·오픈·마감 묶음과 원서접수 외 서비스(직접 추가만)를 하위 탭으로 가른다. */
export function ApplicationTab({
  snapshot,
  detail,
  reportId,
  editable,
  freezeNotice,
  isAdmin,
  settingsHref,
}: Props) {
  const app = snapshot.application;
  const unmatched = snapshot.unmatched.application;
  // 숫자는 KPI 카드와 같은 식 하나(뺀 건 제외 + 직접)다 — 탭 숫자와 카드가 갈릴 수 없다.
  const kpis = computeKpis(snapshot, detail.overrides, detail.manual);
  const shownLists = [
    ...(app.devStatusCollected ? [app.dev, app.test, app.unknown] : []),
    app.opening,
    app.running,
    app.closing,
  ];
  // 뺀 건은 세지 않는다 — 하위 탭·묶음 머리·KPI 와 같은 식(kept).
  const autoCount = shownLists.reduce(
    (n, l) => n + kept(l, detail.overrides),
    0,
  );
  const directCount = detail.manual.filter(
    (m) => m.area === "application",
  ).length;
  const { showUnknown } = appSubStateOf(app);

  const section = (key: string, title: string, list: AutoItem[]) => (
    <AutoGroupSection
      title={title}
      items={applyOverrides(list, detail.overrides)}
      manual={detail.manual}
      reportId={reportId}
      area="application"
      groupKey={key}
      editable={editable}
      emptyText="해당하는 서비스가 없습니다"
    />
  );
  const stage = (key: StageKey, title: string) =>
    app.devStatusCollected ? (
      section(key, title, app[key])
    ) : (
      // 구분이 수집되지 않은 주 — 문구와, 그래도 직접 추가한 건이 있으면 그 목록만.
      <>
        <p className="py-2 text-sm text-muted">
          {`개발/테스트 구분이 아직 수집되지 않았습니다 (시작 전 서비스 ${kept(app.unknown, detail.overrides)}건)`}
        </p>
        {manualCount(detail.manual, "application", [key]) > 0
          ? section(key, title, [])
          : null}
      </>
    );

  const tabs: SubTabItem[] = [
    ...STAGES.map((s) => ({
      key: s.key,
      label: s.title,
      count: kpis[s.key],
    })),
    ...(showUnknown
      ? [
          {
            key: "unknown",
            label: APP_GROUP_TITLE.unknown,
            count: kept(app.unknown, detail.overrides),
          },
        ]
      : []),
    ...AFTER.map((g) => ({ key: g.key, label: g.title, count: kpis[g.key] })),
    {
      key: "other",
      label: APP_GROUP_TITLE.other,
      count: manualCount(detail.manual, "application", ["other"]),
    },
  ];
  const panels = {
    ...Object.fromEntries(STAGES.map((s) => [s.key, stage(s.key, s.title)])),
    ...(showUnknown
      ? { unknown: section("unknown", APP_GROUP_TITLE.unknown, app.unknown) }
      : {}),
    ...Object.fromEntries(
      AFTER.map((g) => [g.key, section(g.key, g.title, app[g.key])]),
    ),
    other: section("other", APP_GROUP_TITLE.other, []),
  };

  return (
    <div className="flex flex-col gap-7">
      <TabHeading
        title="원서접수"
        summary={`자동 ${autoCount}건 · 직접 ${directCount}건`}
      >
        {freezeNotice ? <AutoFreezeNotice /> : null}
        <UnmatchedNotice
          isAdmin={isAdmin}
          count={unmatched}
          noun="서비스"
          action="서비스마감 메뉴에서 담당자 이름을 확인하세요"
          settingsHref={settingsHref}
        />
      </TabHeading>
      <SubTabs
        tab="application"
        ariaLabel="원서접수 묶음"
        tabs={tabs}
        panels={panels}
        defaultKey={defaultAppSub(app.devStatusCollected)}
      />
    </div>
  );
}
