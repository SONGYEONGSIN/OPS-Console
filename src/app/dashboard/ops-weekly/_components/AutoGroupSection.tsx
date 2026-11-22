"use client";

import { useState } from "react";
import { PaginationNav } from "@/components/common/ListPagination";
import type { AutoArea } from "@/features/ops-weekly/constants";
import type { ManualItem, ViewItem } from "@/features/ops-weekly/merge";
import { formatMdHm } from "../_format";
import { GroupShell } from "./GroupShell";
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
  /** 표로 그린다(원서접수) — 일시 칸 이름은 묶음마다 다르다(오픈/마감) */
  table?: { atLabel: string };
};

const TH = "px-3 py-2";

const PAGE_SIZE = 30;

/** 자동 건 뒤에 직접 추가 건을 이어 붙인 목록의 한 쪽 — 두 배열을 그대로 둔 채 잘라 낸다. */
function pageOf<A, B>(
  a: readonly A[],
  b: readonly B[],
  page: number,
): [A[], B[]] {
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  return [
    a.slice(start, end),
    b.slice(Math.max(0, start - a.length), Math.max(0, end - a.length)),
  ];
}
const TD = "px-3 py-2";

function AutoTableRow(props: {
  item: ViewItem;
  reportId: string | null;
  area: AutoArea;
  editable: boolean;
  showOwners: boolean;
}) {
  const { item, reportId, area, editable } = props;
  return (
    <tr
      className={`group border-b border-line-soft align-top hover:bg-line-soft ${
        item.excluded ? "text-muted line-through" : "text-ink"
      }`}
    >
      <td className={`${TD} text-ink-soft`}>{item.universityType ?? "—"}</td>
      <td className={`${TD} text-ink-soft`}>{item.category ?? "—"}</td>
      <td className={`${TD} font-medium break-words`}>{item.title}</td>
      <td className={`${TD} break-words text-ink-soft`}>{item.subtitle}</td>
      <td className={`${TD} whitespace-nowrap tabular-nums text-muted`}>
        {item.at ? formatMdHm(item.at) : "—"}
      </td>
      {props.showOwners ? (
        <td className={`${TD} text-ink-soft`}>
          {item.owners?.join(", ") ?? "—"}
        </td>
      ) : null}
      {/* 일회성: 메모 버튼 둘과 메모 글이 들어갈 최소 폭 */}
      <td className={`${TD} min-w-[12rem]`}>
        <OverrideControls
          reportId={reportId}
          itemKey={item.key}
          label={`${item.title} 메모`}
          area={area}
          note={item.note}
          excluded={item.excluded}
          editable={editable}
        >
          <></>
        </OverrideControls>
      </td>
    </tr>
  );
}

function AutoTable(props: {
  title: string;
  atLabel: string;
  items: ViewItem[];
  manual: ManualItem[];
  reportId: string | null;
  area: AutoArea;
  editable: boolean;
  /** 전체 보고에서만 담당자 칸 — 쪽마다 칸이 바뀌지 않게 묶음 전체로 정해 넘긴다 */
  showOwners: boolean;
}) {
  const {
    title,
    atLabel,
    items,
    manual,
    reportId,
    area,
    editable,
    showOwners,
  } = props;
  const cols = showOwners ? 7 : 6;
  return (
    // 일회성: 6열이 좁은 화면에서 찌그러지지 않는 최소 폭
    <div className="overflow-x-auto">
      <table aria-label={title} className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
            <th className={TH}>대학구분</th>
            <th className={TH}>카테고리</th>
            <th className={TH}>대학명</th>
            <th className={TH}>서비스명</th>
            <th className={TH}>{atLabel}</th>
            {showOwners ? <th className={TH}>담당자</th> : null}
            <th className={TH}>메모</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <AutoTableRow
              key={item.key}
              item={item}
              reportId={reportId}
              area={area}
              editable={editable}
              showOwners={showOwners}
            />
          ))}
          {manual.map((m) => (
            <tr
              key={m.id}
              className="group border-b border-line-soft hover:bg-line-soft"
            >
              <td colSpan={cols} className={TD}>
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
  );
}

function AutoRow(props: {
  item: ViewItem;
  reportId: string | null;
  area: AutoArea;
  editable: boolean;
}) {
  const { item, reportId, area, editable } = props;
  return (
    <li className="group -mx-2 flex flex-col gap-1 px-2 py-2 hover:bg-line-soft">
      <OverrideControls
        reportId={reportId}
        itemKey={item.key}
        label={`${item.title} 메모`}
        area={area}
        note={item.note}
        excluded={item.excluded}
        editable={editable}
      >
        <span className="min-w-0 break-words font-medium">{item.title}</span>
        <span className="min-w-0 break-words text-ink-soft">
          {item.subtitle}
        </span>
        {item.at ? (
          <span className="text-xs tabular-nums text-muted">
            {formatMdHm(item.at)}
          </span>
        ) : null}
        {item.owners ? (
          <span className="text-xs text-muted">{`담당 ${item.owners.join(", ")}`}</span>
        ) : null}
      </OverrideControls>
    </li>
  );
}

/** 자동 목록 한 묶음 — 건별 메모·빼기, 직접 추가 건. */
export function AutoGroupSection(props: Props) {
  const { title, items, reportId, area, groupKey, editable, emptyText } = props;
  const allManual = props.manual.filter(
    (m) => m.area === area && m.group_key === groupKey,
  );
  // 30건 넘으면 쪽으로 나눈다 — 한 화면에 묶음이 여럿이라 주소(?page)가 아니라 묶음마다 상태로 든다.
  const [page, setPage] = useState(1);
  const total = items.length + allManual.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const [pageItems, manual] = pageOf(items, allManual, current);
  const showOwners =
    items.some((i) => i.owners !== undefined) ||
    allManual.some((m) => m.owner !== undefined);
  const list =
    total === 0 ? (
      <p className="py-2 text-sm text-muted">{emptyText}</p>
    ) : props.table ? (
      <AutoTable
        title={title}
        atLabel={props.table.atLabel}
        items={pageItems}
        manual={manual}
        reportId={reportId}
        area={area}
        editable={editable}
        showOwners={showOwners}
      />
    ) : (
      <ul className="flex flex-col divide-y divide-line-soft">
        {pageItems.map((item) => (
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
    );
  const body = (
    <>
      {list}
      {totalPages > 1 ? (
        <PaginationNav
          page={current}
          totalPages={totalPages}
          onChange={setPage}
        />
      ) : null}
    </>
  );
  if (props.collapsed) {
    return (
      <details>
        <summary className="cursor-pointer list-none border-b border-line pb-2">
          <h3 className="inline text-sm font-bold text-ink">{title}</h3>
          <span aria-hidden className="ml-2 text-xs text-muted">
            ▸
          </span>
        </summary>
        {body}
      </details>
    );
  }
  return (
    <GroupShell
      title={title}
      count={items.filter((i) => !i.excluded).length + allManual.length}
      underline={!(props.table && total > 0)}
      headingHidden
    >
      {body}
    </GroupShell>
  );
}
