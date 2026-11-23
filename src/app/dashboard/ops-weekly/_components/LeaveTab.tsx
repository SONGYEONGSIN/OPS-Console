import Link from "next/link";
import type { LeaveItem } from "@/features/ops-weekly/auto-lists/leave";
import {
  applyOverrides,
  type AutoSnapshot,
  type ViewItem,
} from "@/features/ops-weekly/merge";
import type { ReportDetail } from "@/features/ops-weekly/report-queries";
import { formatMdDow } from "../_format";
import { LEAVE_GROUP_TITLE } from "../_groups";
import { GroupShell } from "./GroupShell";
import { ManualRow } from "./ManualRow";
import { OverrideControls } from "./OverrideControls";
import { AutoFreezeNotice } from "./AutoFreezeNotice";
import { areaCounts, countLabel } from "../_area-counts";
import { TabHeading } from "./TabHeading";
import { WritePanelToggle } from "./write-panel-toggle";
import { StickyTitle } from "./StickyTitle";
import {
  BADGE_CLASS,
  ROW_BTN_CLASS,
  STICKY_THEAD_CLASS,
  TABLE_SCROLL_CLASS,
} from "./styles";

type Props = {
  snapshot: AutoSnapshot;
  detail: ReportDetail;
  reportId: string | null;
  editable: boolean;
  freezeNotice: boolean;
};

const SOURCE_LABEL = { backup: "백업요청", schedule: "일정" } as const;

function periodOf(i: LeaveItem): string {
  const start = formatMdDow(i.startYmd);
  return i.endYmd === i.startYmd
    ? start
    : `${start} ~ ${formatMdDow(i.endYmd)}`;
}

const TD = "px-3 py-2";

function LeaveRow(props: {
  item: ViewItem<LeaveItem>;
  reportId: string | null;
  editable: boolean;
  showOwners: boolean;
}) {
  const { item, reportId, editable } = props;
  return (
    <tr
      className={`group border-b border-line-soft align-top hover:bg-line-soft ${
        item.excluded ? "text-muted line-through" : "text-ink"
      }`}
    >
      {props.showOwners ? (
        <td className={`${TD} font-medium`}>
          {item.owners?.join(", ") ?? "—"}
        </td>
      ) : null}
      <td className={`${TD} font-medium`}>
        {item.kindLabel}
        {item.detail ? (
          <span className="block text-xs font-normal text-ink-soft">
            {item.detail}
          </span>
        ) : null}
      </td>
      <td className={`${TD} whitespace-nowrap tabular-nums`}>
        {periodOf(item)}
      </td>
      <td className={`${TD} break-words text-ink-soft`}>{item.subtitle}</td>
      <td className={TD}>
        <span className="flex flex-wrap gap-1">
          {item.sources.map((s) => (
            <span key={s} className={BADGE_CLASS}>
              {SOURCE_LABEL[s]}
            </span>
          ))}
        </span>
      </td>
      {/* 일회성: 메모 버튼 둘과 메모 글이 들어갈 최소 폭 */}
      <td className={`${TD} min-w-[12rem]`}>
        <OverrideControls
          reportId={reportId}
          itemKey={item.key}
          label={`${item.title} 휴가·외근 메모`}
          area="leave"
          note={item.note}
          excluded={item.excluded}
          editable={editable}
        >
          {/* 전체 보고(담당자가 실린 건)는 남의 휴가라 백업 요청을 여기서 만들지 않는다. */}
          {item.needsBackup && !item.excluded && item.owners === undefined ? (
            <Link
              href="/dashboard/backup"
              className={`${ROW_BTN_CLASS} inline-flex items-center no-underline`}
            >
              백업요청 만들기
            </Link>
          ) : (
            <></>
          )}
        </OverrideControls>
      </td>
    </tr>
  );
}

/** 휴가·외근 탭 — 자동 목록도 건마다 메모·빼기가 있다. 직접 추가는 쓸 것 패널이다. */
export function LeaveTab({
  snapshot,
  detail,
  reportId,
  editable,
  freezeNotice,
}: Props) {
  const rows = applyOverrides(snapshot.leave, detail.overrides);
  const manual = detail.manual.filter((m) => m.area === "leave");
  // 전체 보고에서만 담당자가 실려 온다 — 한 사람 보고서에는 칸을 두지 않는다.
  const showOwners =
    rows.some((r) => r.owners !== undefined) ||
    manual.some((m) => m.owner !== undefined);
  // 제목 줄(오른쪽 끝 [특이사항]) → 표, 간격은 원서접수·합격자 발표 하위 탭과 같은 기본(gap-3).
  return (
    <div className="flex flex-col gap-3">
      {/* 제목 줄은 lg 이상에서 영역 탭 줄 아래에 붙는다(원서접수·합격자 발표 하위 탭 줄과 같다). */}
      <StickyTitle className="flex flex-wrap items-baseline gap-x-3">
        <TabHeading
          title="휴가·외근"
          summary={countLabel(areaCounts(snapshot, detail).leave)}
        >
          {freezeNotice ? <AutoFreezeNotice /> : null}
        </TabHeading>
        <WritePanelToggle />
      </StickyTitle>
      <GroupShell
        title={LEAVE_GROUP_TITLE}
        count={rows.length + manual.length}
        underline={rows.length + manual.length === 0}
        // 탭 제목 `휴가·외근 · 자동 n건` 이 이미 같은 말을 한다 — 표 바로 위에 한 번 더 적지 않는다.
        headingHidden
      >
        {rows.length + manual.length === 0 ? (
          <p className="py-2 text-sm text-muted">
            이 주의 휴가·외근이 없습니다
          </p>
        ) : (
          // 일회성: 5열이 좁은 화면에서 찌그러지지 않는 최소 폭
          <div className={TABLE_SCROLL_CLASS}>
            <table
              aria-label={LEAVE_GROUP_TITLE}
              className="w-full min-w-[40rem] text-sm"
            >
              <thead className={STICKY_THEAD_CLASS}>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                  {showOwners ? <th className={TD}>담당자</th> : null}
                  <th className={TD}>구분</th>
                  <th className={TD}>기간</th>
                  <th className={TD}>백업</th>
                  <th className={TD}>출처</th>
                  <th className={TD}>메모</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <LeaveRow
                    key={r.key}
                    item={r}
                    reportId={reportId}
                    editable={editable}
                    showOwners={showOwners}
                  />
                ))}
                {manual.map((m) => (
                  <tr
                    key={m.id}
                    className="group border-b border-line-soft hover:bg-line-soft"
                  >
                    <td colSpan={showOwners ? 6 : 5} className={TD}>
                      <ManualRow
                        as="div"
                        item={m}
                        reportId={reportId}
                        editable={editable}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GroupShell>
    </div>
  );
}
