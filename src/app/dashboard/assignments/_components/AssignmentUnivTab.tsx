"use client";

import { useState } from "react";
import { ListSearch } from "@/components/common/ListSearch";
import { ListPattern } from "../../_components/patterns/ListPattern";
import type { ListRow } from "../../_components/patterns/ListPattern";
import { matchesAssignmentQuery } from "../_row-mapper";

export function AssignmentUnivTab({
  rows,
  title,
}: {
  rows: ListRow[];
  title: string;
}) {
  const [q, setQ] = useState("");
  const filtered = rows.filter((r) => matchesAssignmentQuery(r, q));
  return (
    <>
      <div className="px-7 pt-5">
        <ListSearch
          value={q}
          onChange={setQ}
          placeholder="대학명 · 담당자명 검색"
          className="max-w-md"
        />
      </div>
      <ListPattern
        title={title}
        data={{ rows: filtered }}
        variant="assignments"
        readOnly
      />
    </>
  );
}
