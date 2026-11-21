"use client";

import { useState } from "react";
import { HeaderActionButton } from "@/components/common/HeaderActionButton";
import type { ProjectKind } from "@/features/ops-weekly/constants";
import { normEmail } from "@/features/ops-weekly/email";
import type { WriterCandidate } from "@/features/ops-weekly/roster";
import {
  setProjectOwners,
  upsertProject,
} from "@/features/ops-weekly/settings-actions";
import type { SettingsBundle } from "@/features/ops-weekly/settings-queries";
import { BTN_CLASS, ERROR_CLASS, FIELD_CLASS } from "./styles";
import { useSettingsSave } from "./use-settings-save";

type Project = SettingsBundle["projects"][number];
type Draft = Omit<Project, "id"> & { id?: string };

const KIND_LABEL: Record<ProjectKind, string> = {
  project: "프로젝트",
  tf: "TF",
};

function blankOf(order: number): Draft {
  return {
    name: "",
    kind: "project",
    sortOrder: order,
    active: true,
    owners: [],
  };
}

function ProjectRow(props: {
  initial: Draft;
  writers: readonly WriterCandidate[];
  names: ReadonlyMap<string, string>;
  onCreated?: () => void;
}) {
  const { initial, writers, names, onCreated } = props;
  const save = useSettingsSave();
  const [d, setD] = useState<Draft>(initial);
  const label = d.name === "" ? "새 항목" : d.name;
  // 제외·퇴사로 명단에서 빠진 기존 담당자 — 체크박스가 없으면 풀 수 없어 저장이 계속 거절된다.
  const listed = new Set(writers.map((w) => normEmail(w.email)));
  const outside = d.owners.filter((o) => !listed.has(normEmail(o)));
  const toggleOwner = (email: string, on: boolean) => {
    patch({
      owners: on
        ? [...d.owners, email]
        : d.owners.filter((x) => normEmail(x) !== normEmail(email)),
    });
  };
  const patch = (p: Partial<Draft>) => {
    setD({ ...d, ...p });
  };

  function submit() {
    save.run(async () => {
      const res = await upsertProject({
        id: d.id,
        name: d.name.trim(),
        kind: d.kind,
        sortOrder: d.sortOrder,
        active: d.active,
      });
      // 새 항목은 id 가 생긴 뒤(새로 읽은 뒤)에야 담당자를 붙일 수 있다.
      if (!res.ok) return res;
      if (d.id === undefined) {
        onCreated?.();
        return res;
      }
      return setProjectOwners({ projectId: d.id, emails: d.owners });
    });
  }

  return (
    <tr className="border-t border-line-soft align-top">
      <td className="py-1 pr-2">
        <input
          aria-label={`${label} 이름`}
          className={FIELD_CLASS}
          value={d.name}
          onChange={(e) => {
            patch({ name: e.target.value });
          }}
        />
      </td>
      <td className="py-1 pr-2">
        <select
          aria-label={`${label} 구분`}
          className={FIELD_CLASS}
          value={d.kind}
          onChange={(e) => {
            patch({ kind: e.target.value === "tf" ? "tf" : "project" });
          }}
        >
          <option value="project">{KIND_LABEL.project}</option>
          <option value="tf">{KIND_LABEL.tf}</option>
        </select>
      </td>
      <td className="py-1 pr-2">
        <input
          type="number"
          aria-label={`${label} 순서`}
          className={`${FIELD_CLASS} w-16 tabular-nums`}
          value={d.sortOrder}
          onChange={(e) => {
            patch({ sortOrder: Number(e.target.value) });
          }}
        />
      </td>
      <td className="py-1 pr-2">
        <input
          type="checkbox"
          aria-label={`${label} 사용`}
          checked={d.active}
          onChange={(e) => {
            patch({ active: e.target.checked });
          }}
        />
      </td>
      <td className="py-1 pr-2">
        {d.id === undefined ? (
          <span className="text-xs text-muted">저장한 뒤 지정합니다</span>
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {writers.map((w) => (
              <label key={w.email} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  aria-label={`${label} 담당 ${w.name}`}
                  checked={d.owners.includes(w.email)}
                  onChange={(e) => {
                    toggleOwner(w.email, e.target.checked);
                  }}
                />
                {w.name}
              </label>
            ))}
            {outside.map((o) => {
              const text = `${names.get(normEmail(o)) ?? o} (작성 명단 밖)`;
              return (
                <label
                  key={o}
                  className="flex items-center gap-1 text-xs text-muted"
                >
                  <input
                    type="checkbox"
                    aria-label={`${label} 담당 ${text}`}
                    checked
                    onChange={(e) => {
                      toggleOwner(o, e.target.checked);
                    }}
                  />
                  {text}
                </label>
              );
            })}
          </div>
        )}
      </td>
      <td className="py-1">
        <button
          type="button"
          className={BTN_CLASS}
          disabled={save.pending}
          aria-label={`${label} 저장`}
          onClick={submit}
        >
          저장
        </button>
        {save.error !== null ? (
          <p role="alert" className={ERROR_CLASS}>
            {save.error}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

export function ProjectCatalogPanel(props: {
  projects: SettingsBundle["projects"];
  writers: readonly WriterCandidate[];
  /** 제외된 사람까지 포함한 이름 조회용 */
  candidates: readonly WriterCandidate[];
}) {
  const { projects, writers, candidates } = props;
  const names = new Map(candidates.map((c) => [normEmail(c.email), c.name]));
  const [drafts, setDrafts] = useState<number[]>([]);
  const nextOrder = projects.reduce((m, p) => Math.max(m, p.sortOrder), 0) + 1;
  return (
    <section aria-label="프로젝트·TF" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-ink">프로젝트·TF</h2>
        <HeaderActionButton
          onClick={() => {
            setDrafts([...drafts, drafts.length]);
          }}
        >
          + 항목 추가
        </HeaderActionButton>
      </div>
      {/* 일회성: 입력·선택 칸이 든 행이 찌그러지지 않는 최소 폭 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pr-2 font-normal">항목명</th>
              <th className="pr-2 font-normal">구분</th>
              <th className="pr-2 font-normal">순서</th>
              <th className="pr-2 font-normal">사용</th>
              <th className="pr-2 font-normal">담당자</th>
              <th className="font-normal" />
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <ProjectRow
                key={p.id}
                initial={p}
                writers={writers}
                names={names}
              />
            ))}
            {drafts.map((k) => (
              <ProjectRow
                key={`new-${k}`}
                initial={blankOf(nextOrder + k)}
                writers={writers}
                names={names}
                onCreated={() => {
                  setDrafts((cur) => cur.filter((x) => x !== k));
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
