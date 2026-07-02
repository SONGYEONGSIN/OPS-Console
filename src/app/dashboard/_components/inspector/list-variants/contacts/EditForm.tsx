"use client";

import { useState } from "react";
import type { EditFormProps } from "../types";
import { ListSearch } from "@/components/common/ListSearch";

const ACTIVE_OPTIONS = ["재직", "타부서 이동"] as const;
const JOB_ROLE_OPTIONS = ["실무자", "관리자"] as const;
const MANAGEMENT_GRADE_OPTIONS = ["A", "B", "C", "D"] as const;
const RELATIONSHIP_GRADE_OPTIONS = ["우호적", "보통", "주의"] as const;

export function ContactsForm({
  row,
  setRow,
  onSave,
  onCancel,
  universityNameSuggestions = [],
}: EditFormProps) {
  // 대학명 검색 combobox — backup 패턴 동일 (입력 시에만 dropdown)
  const [universityQuery, setUniversityQuery] = useState("");
  const [justSelected, setJustSelected] = useState(false);
  const trimmedUniversity = universityQuery.trim();
  const universityMatches =
    trimmedUniversity.length === 0
      ? []
      : universityNameSuggestions
          .filter((u) => u.includes(trimmedUniversity))
          .slice(0, 10);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">활성화</span>
          <select
            aria-label="활성화"
            value={row.customerActive ?? "재직"}
            onChange={(e) => setRow({ ...row, customerActive: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          >
            {ACTIVE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">고객명</span>
          <input
            aria-label="고객명"
            value={row.name ?? ""}
            onChange={(e) => setRow({ ...row, name: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
            required
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">직함</span>
          <input
            aria-label="직함"
            value={row.jobTitle ?? ""}
            onChange={(e) =>
              setRow({ ...row, jobTitle: e.target.value || null })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
            placeholder="팀장 / 과장 / 주임 / ..."
          />
        </label>
      </div>

      <div className="block text-xs">
        <span className="mb-1 block text-muted">대학명 (검색)</span>
        <ListSearch
          value={universityQuery || (row.universityName ?? "")}
          onChange={(v) => {
            setUniversityQuery(v);
            setRow({ ...row, universityName: v });
            setJustSelected(false);
          }}
          placeholder="대학명을 검색하거나 직접 입력"
          ariaLabel="대학명"
          size="sm"
        />
        {!justSelected && universityMatches.length > 0 && (
          <ul
            aria-label="대학명 검색 결과"
            className="mt-1 max-h-40 overflow-y-auto border border-line-soft bg-washi-raised"
          >
            {universityMatches.map((u) => (
              <li key={u}>
                <button
                  type="button"
                  onClick={() => {
                    setRow({ ...row, universityName: u });
                    setUniversityQuery(u);
                    setJustSelected(true);
                  }}
                  className="block w-full cursor-pointer border-none bg-transparent px-2 py-1 text-left text-2xs text-ink hover:bg-line-soft"
                >
                  {u}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">소속부서</span>
          <input
            aria-label="소속부서"
            value={row.departmentName ?? ""}
            onChange={(e) =>
              setRow({ ...row, departmentName: e.target.value || null })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
            placeholder="입학팀 / 입학처 / ..."
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">직책</span>
          <select
            aria-label="직책"
            value={row.jobRole ?? ""}
            onChange={(e) =>
              setRow({ ...row, jobRole: e.target.value || null })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          >
            <option value="">선택...</option>
            {JOB_ROLE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">관리 등급</span>
          <select
            aria-label="관리 등급"
            value={row.managementGrade ?? ""}
            onChange={(e) =>
              setRow({ ...row, managementGrade: e.target.value || null })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          >
            <option value="">선택...</option>
            {MANAGEMENT_GRADE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">관계 등급</span>
          <select
            aria-label="관계 등급"
            value={row.relationshipGrade ?? ""}
            onChange={(e) =>
              setRow({ ...row, relationshipGrade: e.target.value || null })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          >
            <option value="">선택...</option>
            {RELATIONSHIP_GRADE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">휴대폰</span>
          <input
            aria-label="휴대폰"
            value={row.contactPhone ?? ""}
            onChange={(e) =>
              setRow({ ...row, contactPhone: e.target.value || null })
            }
            placeholder="010-0000-0000"
            className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">내선</span>
          <input
            aria-label="내선"
            value={row.contactExt ?? ""}
            onChange={(e) =>
              setRow({ ...row, contactExt: e.target.value || null })
            }
            placeholder="031-000-0000"
            className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          />
        </label>
      </div>

      <label className="block text-xs">
        <span className="mb-1 block text-muted">이메일</span>
        <input
          type="email"
          aria-label="이메일"
          value={row.contactEmail ?? ""}
          onChange={(e) =>
            setRow({ ...row, contactEmail: e.target.value || null })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
        />
      </label>

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

      {row.id !== "" && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "이 연락처를 삭제하시겠습니까? 되돌릴 수 없습니다.",
                )
              ) {
                onSave({ ...row, status: "deleted" });
              }
            }}
            className="w-full border border-vermilion-deep bg-transparent px-3 py-1.5 text-sm text-vermilion-deep hover:bg-vermilion-deep hover:text-cream"
          >
            삭제
          </button>
        </div>
      )}
    </form>
  );
}
