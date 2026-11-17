import type { AutoItem } from "@/features/ops-weekly/auto-lists/application";
import { applyOverrides, type AutoSnapshot } from "@/features/ops-weekly/merge";
import type { ReportDetail } from "@/features/ops-weekly/report-queries";
import { AreaNotes } from "./AreaNotes";
import { AutoGroupSection } from "./AutoGroupSection";
import { AutoFreezeNotice } from "./AutoFreezeNotice";
import { TabHeading } from "./TabHeading";

type Props = {
  snapshot: AutoSnapshot;
  detail: ReportDetail;
  reportId: string | null;
  editable: boolean;
  freezeNotice?: boolean;
};

type GroupKey = "dev" | "test" | "opening" | "running" | "closing";
const DEV_TEST: readonly { key: GroupKey; title: string }[] = [
  { key: "dev", title: "개발 중" },
  { key: "test", title: "테스트 중" },
];
const AFTER: readonly { key: GroupKey; title: string }[] = [
  { key: "opening", title: "차주 오픈 예정" },
  { key: "running", title: "운영 중" },
  { key: "closing", title: "차주 마감 예정" },
];

/** 원서접수 탭 — 개발·테스트·오픈·운영·마감 묶음과 원서접수 외 서비스(직접 추가만). */
export function ApplicationTab({
  snapshot,
  detail,
  reportId,
  editable,
  freezeNotice = false,
}: Props) {
  const app = snapshot.application;
  const unmatched = snapshot.unmatched.application;
  const shownLists = [
    ...(app.devStatusCollected ? [app.dev, app.test, app.unknown] : []),
    app.opening,
    app.running,
    app.closing,
  ];
  const autoCount = shownLists.reduce((n, l) => n + l.length, 0);
  // 구분이 수집되지 않은 주에는 개발·테스트 묶음이 안 보이므로 그 묶음의 직접 추가 건도 세지 않는다.
  const hiddenGroups = app.devStatusCollected ? [] : ["dev", "test"];
  const manualCount = detail.manual.filter(
    (m) =>
      m.area === "application" && !hiddenGroups.includes(m.group_key ?? ""),
  ).length;
  const section = (
    key: string,
    title: string,
    list: AutoItem[],
    unknownGroup = false,
  ) => (
    <AutoGroupSection
      key={key}
      title={title}
      items={applyOverrides(list, detail.overrides)}
      manual={detail.manual}
      reportId={reportId}
      area="application"
      groupKey={key}
      editable={editable}
      emptyText="해당하는 서비스가 없습니다"
      collapsed={unknownGroup}
      allowAdd={!unknownGroup}
    />
  );
  return (
    <div className="flex flex-col gap-7 p-5 lg:p-7">
      <TabHeading
        title="원서접수"
        summary={`자동 ${autoCount}건 · 직접 ${manualCount}건`}
      >
        {freezeNotice ? <AutoFreezeNotice /> : null}
        <p className="text-sm text-muted">
          {`담당자가 맞지 않아 아무에게도 안 붙은 서비스 ${unmatched}건${
            unmatched > 0
              ? " — 서비스 마감 메뉴에서 담당자 이름을 확인하세요"
              : ""
          }`}
        </p>
      </TabHeading>
      <div className="flex flex-col gap-6">
        {app.devStatusCollected ? (
          <>
            {DEV_TEST.map((g) => section(g.key, g.title, app[g.key]))}
            {app.unknown.length > 0
              ? section(
                  "unknown",
                  `구분 미확인 ${app.unknown.length}건`,
                  app.unknown,
                  true,
                )
              : null}
          </>
        ) : (
          <p className="text-sm text-muted">
            {`개발/테스트 구분 미확인 — 작업 통계가 아직 수집되지 않았습니다 (시작 전 서비스 ${app.unknown.length}건)`}
          </p>
        )}
        {AFTER.map((g) => section(g.key, g.title, app[g.key]))}
        {section("other", "원서접수 외 서비스", [])}
      </div>
      <AreaNotes
        reportId={reportId}
        area="application"
        thisWeek={detail.notes.application.thisWeek}
        nextWeek={detail.notes.application.nextWeek}
        editable={editable}
      />
    </div>
  );
}
