"use client";

import Link from "next/link";
import { ListSelect } from "@/components/common/ListSelect";
import type { CheckItem } from "@/features/sms-sender/types";
import { useSetParams } from "./use-set-params";

const TH = "px-3 py-2 font-normal";
const TEXT = "whitespace-pre-line";

function Target({ item }: { item: CheckItem }) {
  if (item.schoolNo == null) {
    return <span className={TEXT}>{item.target}</span>;
  }
  const [first, ...rest] = item.target.split("\n");
  return (
    <>
      <Link
        href={`/dashboard/internal-admin?tab=schools&school=${item.schoolNo}`}
        className="underline"
      >
        {first}
      </Link>
      {rest.length > 0 && <div className={TEXT}>{rest.join("\n")}</div>}
    </>
  );
}

export function ChecksTab({
  rows,
  total,
  kind,
  kindOptions,
}: {
  rows: CheckItem[];
  total: number;
  kind: string;
  kindOptions: string[];
}) {
  const setParams = useSetParams();
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ListSelect
          value={kind}
          onChange={(v) => setParams({ type: v || null })}
          options={kindOptions}
          placeholder="유형 전체"
          ariaLabel="유형 필터"
        />
        <span className="text-sm tabular-nums text-muted">{`확인 필요 ${total}건`}</span>
      </div>
      {rows.length === 0 ? (
        <p className="bg-situation-bg px-3 py-8 text-center text-sm text-muted">
          확인할 항목이 없습니다
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
              {["유형", "대상", "내용", "근거", "할 일"].map((h) => (
                <th key={h} className={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.no}
                className="border-b border-line-soft align-top hover:bg-line-soft"
              >
                <td className="px-3 py-2">{c.kind}</td>
                <td className="px-3 py-2">
                  <Target item={c} />
                </td>
                <td className={`px-3 py-2 ${TEXT}`}>{c.content}</td>
                <td className={`px-3 py-2 ${TEXT}`}>{c.basis}</td>
                <td className={`px-3 py-2 ${TEXT}`}>{c.todo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
