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
import { TabHeading } from "./TabHeading";
import { BADGE_CLASS, ROW_BTN_CLASS } from "./styles";

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

function LeaveRow(props: {
  item: ViewItem<LeaveItem>;
  reportId: string | null;
  editable: boolean;
}) {
  const { item, reportId, editable } = props;
  return (
    <li className="group -mx-2 flex flex-col gap-1 px-2 py-2 hover:bg-line-soft">
      <OverrideControls
        reportId={reportId}
        itemKey={item.key}
        label={`${item.title} 휴가·외근 메모`}
        area="leave"
        note={item.note}
        excluded={item.excluded}
        editable={editable}
      >
        <span className="font-medium">{item.kindLabel}</span>
        <span className="text-xs tabular-nums">{periodOf(item)}</span>
        <span className="min-w-0 break-words text-xs">{item.subtitle}</span>
        {item.sources.map((s) => (
          <span key={s} className={BADGE_CLASS}>
            {SOURCE_LABEL[s]}
          </span>
        ))}
        {item.needsBackup && !item.excluded ? (
          <Link
            href="/dashboard/backup"
            className={`${ROW_BTN_CLASS} inline-flex items-center no-underline`}
          >
            백업요청 만들기
          </Link>
        ) : null}
      </OverrideControls>
    </li>
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
  return (
    <div className="flex flex-col gap-7">
      <TabHeading
        title="휴가·외근"
        summary={`자동 ${rows.length}건 · 직접 ${manual.length}건`}
      >
        {freezeNotice ? <AutoFreezeNotice /> : null}
      </TabHeading>
      <GroupShell title={LEAVE_GROUP_TITLE} count={rows.length + manual.length}>
        {rows.length + manual.length === 0 ? (
          <p className="py-2 text-sm text-muted">
            이 주의 휴가·외근이 없습니다
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {rows.map((r) => (
              <LeaveRow
                key={r.key}
                item={r}
                reportId={reportId}
                editable={editable}
              />
            ))}
            {manual.map((m) => (
              <ManualRow
                key={m.id}
                item={m}
                reportId={reportId}
                editable={editable}
              />
            ))}
          </ul>
        )}
      </GroupShell>
    </div>
  );
}
