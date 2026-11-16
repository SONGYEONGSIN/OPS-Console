"use client";

import type { AutoArea } from "@/features/ops-weekly/constants";
import type { ManualItem, ViewItem } from "@/features/ops-weekly/merge";
import { formatMdHm } from "../_format";
import { ManualItemForm } from "./ManualItemForm";
import { ManualRow } from "./ManualRow";
import { OverrideControls } from "./OverrideControls";

type Props = {
  title: string;
  items: ViewItem[];
  manual: ManualItem[];
  reportId: string | null;
  area: AutoArea;
  groupKey: string | null;
  editable: boolean;
  emptyText: string;
  /** 접어서 보여 준다 — 제목이 summary 안에 든다 */
  collapsed?: boolean;
  /** false 면 직접 추가 폼을 안 낸다 */
  allowAdd?: boolean;
};

function AutoRow(props: {
  item: ViewItem;
  reportId: string | null;
  area: AutoArea;
  editable: boolean;
}) {
  const { item, reportId, area, editable } = props;
  return (
    <li className="flex flex-col gap-1 px-2 py-2 hover:bg-line-soft">
      <div
        className={`flex flex-wrap items-baseline gap-2 text-sm ${
          item.excluded ? "text-muted line-through" : "text-ink"
        }`}
      >
        <span className="min-w-0 break-words font-medium">{item.title}</span>
        <span className="min-w-0 break-words">{item.subtitle}</span>
        {item.at ? (
          <span className="text-xs tabular-nums text-muted">
            {formatMdHm(item.at)}
          </span>
        ) : null}
      </div>
      <OverrideControls
        reportId={reportId}
        itemKey={item.key}
        area={area}
        note={item.note}
        excluded={item.excluded}
        editable={editable}
      />
    </li>
  );
}

/** 자동 목록 한 묶음 — 건별 메모·빼기, 직접 추가 건, 추가 폼. */
export function AutoGroupSection(props: Props) {
  const { title, items, reportId, area, groupKey, editable, emptyText } = props;
  const manual = props.manual.filter(
    (m) => m.area === area && m.group_key === groupKey,
  );
  const heading = <h3 className="text-sm font-bold text-ink">{title}</h3>;
  const body = (
    <>
      {items.length + manual.length === 0 ? (
        <p className="px-2 py-2 text-sm text-muted">{emptyText}</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => (
            <AutoRow
              key={item.key}
              item={item}
              reportId={reportId}
              area={area}
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
      {editable && reportId !== null && props.allowAdd !== false ? (
        <ManualItemForm reportId={reportId} area={area} groupKey={groupKey} />
      ) : null}
    </>
  );
  if (props.collapsed) {
    return (
      <details className="border border-line-soft p-3">
        <summary className="cursor-pointer">{heading}</summary>
        {body}
      </details>
    );
  }
  return (
    <section className="flex flex-col gap-1 border border-line-soft p-3">
      {heading}
      {body}
    </section>
  );
}
