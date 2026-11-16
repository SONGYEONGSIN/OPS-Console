import Link from "next/link";
import type { LeaveItem } from "@/features/ops-weekly/auto-lists/leave";
import {
  applyOverrides,
  type AutoSnapshot,
  type ViewItem,
} from "@/features/ops-weekly/merge";
import type { ReportDetail } from "@/features/ops-weekly/report-queries";
import { formatMdDow } from "../_format";
import { AreaNotes } from "./AreaNotes";
import { ManualItemForm } from "./ManualItemForm";
import { ManualRow } from "./ManualRow";
import { OverrideControls } from "./OverrideControls";
import { BADGE_CLASS, BTN_CLASS } from "./styles";

type Props = {
  snapshot: AutoSnapshot;
  detail: ReportDetail;
  reportId: string | null;
  editable: boolean;
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
    <li className="flex flex-col gap-1 px-2 py-2 hover:bg-line-soft">
      <div
        className={`flex flex-wrap items-center gap-2 text-sm ${
          item.excluded ? "text-muted line-through" : "text-ink"
        }`}
      >
        <span className="font-medium">{item.title}</span>
        <span>{item.kindLabel}</span>
        <span className="text-xs tabular-nums">{periodOf(item)}</span>
        <span className="text-xs">{item.subtitle}</span>
        {item.sources.map((s) => (
          <span key={s} className={BADGE_CLASS}>
            {SOURCE_LABEL[s]}
          </span>
        ))}
        {item.needsBackup && !item.excluded ? (
          <Link
            href="/dashboard/backup"
            className={`${BTN_CLASS} ml-auto no-underline`}
          >
            백업요청 만들기
          </Link>
        ) : null}
      </div>
      <OverrideControls
        reportId={reportId}
        itemKey={item.key}
        area="leave"
        note={item.note}
        excluded={item.excluded}
        editable={editable}
      />
    </li>
  );
}

/** 휴가·외근 탭 — 자동 목록도 건마다 메모·빼기가 있고 직접 추가할 수 있다. */
export function LeaveTab({ snapshot, detail, reportId, editable }: Props) {
  const rows = applyOverrides(snapshot.leave, detail.overrides);
  const manual = detail.manual.filter((m) => m.area === "leave");
  return (
    <div className="flex flex-col gap-4 p-5 lg:p-7">
      <section className="flex flex-col gap-1 border border-line-soft p-3">
        <h3 className="text-sm font-bold text-ink">휴가·외근 일정</h3>
        {rows.length + manual.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted">
            이 주의 휴가·외근이 없습니다
          </p>
        ) : (
          <ul className="flex flex-col">
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
        {editable && reportId !== null ? (
          <ManualItemForm
            reportId={reportId}
            area="leave"
            groupKey={null}
            leave
          />
        ) : null}
      </section>
      <AreaNotes
        reportId={reportId}
        area="leave"
        thisWeek={detail.notes.leave.thisWeek}
        nextWeek={detail.notes.leave.nextWeek}
        editable={editable}
      />
    </div>
  );
}
