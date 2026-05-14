"use client";

import { useState } from "react";
import type { EditFormProps } from "../types";
import {
  APPLICATION_TYPE_OPTIONS,
  REGION_OPTIONS,
  UNIVERSITY_TYPE_OPTIONS,
  CATEGORY_OPTIONS,
} from "@/features/services/constants";

function isoToDate(iso?: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function dateToIso(date: string): string | null {
  if (!date) return null;
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}

export function ServicesForm({
  row,
  setRow,
  onSave,
  onCancel,
  servicesOperators = [],
  servicesUniversityKeys = [],
}: EditFormProps) {
  // 대학명 검색 combobox 상태 — 입력값과 row.universityName이 일치하면 dropdown 숨김
  const [universityQuery, setUniversityQuery] = useState("");
  const trimmedQuery = universityQuery.trim();
  const universityMatches =
    trimmedQuery.length === 0
      ? []
      : servicesUniversityKeys
          .filter(
            (u) =>
              u.universityName.includes(trimmedQuery) &&
              u.universityName !== row.universityName,
          )
          .slice(0, 10);

  // 현재 universityName이 키 목록에 있다면 학교키 힌트 표시
  const selectedUniversity = servicesUniversityKeys.find(
    (u) => u.universityName === row.universityName,
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="block text-xs">
          <span className="mb-1 block text-muted">대학명 (검색)</span>
          <input
            aria-label="대학명"
            type="search"
            value={universityQuery || (row.universityName ?? "")}
            onChange={(e) => {
              setUniversityQuery(e.target.value);
              setRow({ ...row, universityName: e.target.value });
            }}
            placeholder="대학명을 검색하거나 직접 입력"
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
            required
          />
          {universityMatches.length > 0 && (
            <ul
              aria-label="대학명 검색 결과"
              className="mt-1 max-h-40 overflow-y-auto border border-line-soft bg-washi-raised"
            >
              {universityMatches.map((u) => (
                <li key={u.universityName}>
                  <button
                    type="button"
                    onClick={() => {
                      // 기존 대학 선택 시: universityName + service_id 자동 부여
                      // (학교키 4자리 × 1000 + 다음 시퀀스 3자리).
                      // 자유 입력 케이스(검색에 매칭 없음)에서는 dropdown 자체가 안 떠서
                      // service_id 자동 채움이 발생하지 않음 → admin이 수동 입력.
                      setRow({
                        ...row,
                        universityName: u.universityName,
                        serviceIdNum: u.key * 1000 + u.nextSeq,
                      });
                      setUniversityQuery("");
                    }}
                    className="block w-full cursor-pointer border-none bg-transparent px-2 py-1 text-left text-2xs text-ink hover:bg-line-soft"
                  >
                    <span>{u.universityName}</span>
                    <span className="ml-2 font-mono text-muted">
                      {u.key}
                      {String(u.nextSeq).padStart(3, "0")} 자동 부여
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">서비스명</span>
          <input
            aria-label="서비스명"
            value={row.serviceName ?? ""}
            onChange={(e) => setRow({ ...row, serviceName: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
            required
          />
        </label>
      </div>

      <label className="block text-xs">
        <span className="mb-1 flex items-baseline justify-between text-muted">
          <span>service_id (수동)</span>
          {selectedUniversity && (
            <span className="text-2xs">
              이 대학 학교키:{" "}
              <span className="font-mono text-ink">
                {selectedUniversity.key}
              </span>
              {" · "}
              제안 시퀀스:{" "}
              <span className="font-mono text-ink">
                {String(selectedUniversity.nextSeq).padStart(3, "0")}
              </span>
            </span>
          )}
        </span>
        <input
          type="number"
          aria-label="service_id"
          value={row.serviceIdNum ?? ""}
          onChange={(e) =>
            setRow({
              ...row,
              serviceIdNum: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          className="w-full border border-line bg-cream px-2 py-1 font-mono text-ink"
          placeholder={
            selectedUniversity
              ? `${selectedUniversity.key}${String(selectedUniversity.nextSeq).padStart(3, "0")}`
              : "학교키 4자리 + 시퀀스 3자리"
          }
          required
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">접수구분</span>
          <select
            aria-label="접수구분"
            value={row.applicationType ?? ""}
            onChange={(e) =>
              setRow({ ...row, applicationType: e.target.value })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="">선택…</option>
            {APPLICATION_TYPE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">지역</span>
          <select
            aria-label="지역"
            value={row.region ?? ""}
            onChange={(e) => setRow({ ...row, region: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="">선택…</option>
            {REGION_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">대학구분</span>
          <select
            aria-label="대학구분"
            value={row.universityType ?? ""}
            onChange={(e) => setRow({ ...row, universityType: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="">선택…</option>
            {UNIVERSITY_TYPE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">카테고리</span>
          <select
            aria-label="카테고리"
            value={row.category ?? ""}
            onChange={(e) => setRow({ ...row, category: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="">선택…</option>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">운영자</span>
          <select
            aria-label="운영자"
            value={row.operatorEmail ?? ""}
            onChange={(e) => {
              const email = e.target.value;
              const op = servicesOperators.find((o) => o.email === email);
              setRow({
                ...row,
                operatorEmail: email || null,
                operatorName: op?.name ?? null,
              });
            }}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="">선택…</option>
            {servicesOperators.map((op) => (
              <option key={op.email} value={op.email}>
                {op.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">개발자</span>
          <select
            aria-label="개발자"
            value={row.developerEmail ?? ""}
            onChange={(e) => {
              const email = e.target.value;
              const op = servicesOperators.find((o) => o.email === email);
              setRow({
                ...row,
                developerEmail: email || null,
                developerName: op?.name ?? null,
              });
            }}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="">선택…</option>
            {servicesOperators.map((op) => (
              <option key={op.email} value={op.email}>
                {op.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* #8: 4 date를 2x2 grid (작성 줄 / 결제 줄)로 분리 */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">작성시작</span>
          <input
            type="date"
            aria-label="작성시작"
            value={isoToDate(row.writeStartAt)}
            onChange={(e) =>
              setRow({ ...row, writeStartAt: dateToIso(e.target.value) })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">작성마감</span>
          <input
            type="date"
            aria-label="작성마감"
            value={isoToDate(row.writeEndAt)}
            onChange={(e) =>
              setRow({ ...row, writeEndAt: dateToIso(e.target.value) })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">결제시작</span>
          <input
            type="date"
            aria-label="결제시작"
            value={isoToDate(row.payStartAt)}
            onChange={(e) =>
              setRow({ ...row, payStartAt: dateToIso(e.target.value) })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">결제마감</span>
          <input
            type="date"
            aria-label="결제마감"
            value={isoToDate(row.payEndAt)}
            onChange={(e) =>
              setRow({ ...row, payEndAt: dateToIso(e.target.value) })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs text-ink">
        <input
          type="checkbox"
          aria-label="단독여부"
          checked={row.solo ?? false}
          onChange={(e) => setRow({ ...row, solo: e.target.checked })}
        />
        단독여부
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
                  "이 서비스를 삭제하시겠습니까? 되돌릴 수 없습니다.",
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
