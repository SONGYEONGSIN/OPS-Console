"use client";

import { useState } from "react";
import type { AutoArea } from "@/features/ops-weekly/constants";
import type { DirectAddGroup } from "../_groups";
import { PIMS_SUBS, parseSub, resolveAppSub } from "../_params";
import { ManualItemForm } from "./ManualItemForm";
import { FIELD_CLASS } from "./styles";
import { useOpsSub } from "./use-ops-sub";

type AppSubState = { showUnknown: boolean; collected: boolean };

type Props = {
  area: AutoArea;
  reportId: string;
  groups: readonly DirectAddGroup[];
  appSubState: AppSubState;
};

/** 왼쪽에서 보는 하위 칸 — 직접 추가가 없는 묶음(구분 미확인)이면 첫 묶음. */
function defaultKeyOf(
  area: AutoArea,
  raw: string | null,
  state: AppSubState,
  groups: readonly DirectAddGroup[],
): string | null {
  const seen =
    area === "application"
      ? resolveAppSub(raw, state)
      : area === "pims"
        ? parseSub("pims", raw, PIMS_SUBS)
        : null;
  const found = groups.find((g) => g.key === seen);
  return (found ?? groups[0])?.key ?? null;
}

/**
 * 쓸 것 패널의 직접 추가 — 묶음 선택 + 입력. 늘 열려 있다.
 * 묶음 기본값은 왼쪽 하위 칸을 따라가고, 사람이 고른 값은 그 기본값이 바뀌기 전까지 남는다.
 * 폼은 묶음을 바꿔도 다시 만들지 않아 쓰던 제목이 남는다.
 */
export function DirectAddPanel({ area, reportId, groups, appSubState }: Props) {
  const { raw } = useOpsSub();
  const base = defaultKeyOf(area, raw, appSubState, groups);
  const [pick, setPick] = useState<{ base: string | null; key: string | null } | null>(null);
  if (pick !== null && pick.base !== base) setPick(null);
  const key = pick !== null ? pick.key : base;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-bold text-ink">직접 추가</h3>
      {groups.length > 1 ? (
        <select
          aria-label="묶음"
          className={FIELD_CLASS}
          value={key ?? ""}
          onChange={(e) => setPick({ base, key: e.target.value })}
        >
          {groups.map((g) => (
            <option key={g.key ?? ""} value={g.key ?? ""}>
              {g.label}
            </option>
          ))}
        </select>
      ) : null}
      <ManualItemForm
        reportId={reportId}
        area={area}
        groupKey={key}
        leave={area === "leave"}
      />
    </div>
  );
}
