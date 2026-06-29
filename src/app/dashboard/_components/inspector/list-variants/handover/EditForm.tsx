"use client";

import { useState } from "react";
import { type HandoverCategoryKey } from "@/features/handover/categories";
import { CategoryTabs } from "./CategoryTabs";
import { HandoverCategoryFields } from "./HandoverCategoryFields";
import { CopySection } from "./CopySection";
import type { EditFormProps } from "../types";

export function HandoverEditForm({
  row,
  setRow,
  onSave,
  onCancel,
  handoverServiceCandidates,
  onCopyHandover,
  contractsStatusOptions,
}: EditFormProps) {
  const [active, setActive] = useState<HandoverCategoryKey>("contract");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <div className="mb-6">
        <CategoryTabs active={active} onChange={setActive} />
      </div>

      <HandoverCategoryFields
        row={row}
        setRow={setRow}
        category={active}
        contractsStatusOptions={contractsStatusOptions}
      />

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
      {onCopyHandover ? (
        <CopySection
          fromServiceId={row.id}
          candidates={handoverServiceCandidates ?? []}
          onCopy={onCopyHandover}
        />
      ) : null}
    </form>
  );
}
