"use client";

import { ListSelect } from "@/components/common/ListSelect";
import { normEmail } from "@/features/ops-weekly/email";
import type { WriterCandidate } from "@/features/ops-weekly/roster";
import type { WeekRow } from "@/features/ops-weekly/schemas";

export function DutyPicker(props: {
  week: Pick<WeekRow, "duty_email">;
  writers: readonly WriterCandidate[];
  onPick: (email: string) => void;
}) {
  const { week, writers, onPick } = props;
  const current = normEmail(week.duty_email ?? "");
  const value = writers.find((w) => w.email === current)?.name ?? "";
  return (
    <ListSelect
      ariaLabel="당번"
      className="max-w-full"
      placeholder="당번 미지정"
      value={value}
      options={writers.map((w) => w.name)}
      onChange={(name) => {
        const w = writers.find((x) => x.name === name);
        if (w) onPick(w.email);
      }}
    />
  );
}
