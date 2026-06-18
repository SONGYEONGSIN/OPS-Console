"use client";

import { useState, useMemo } from "react";
import type { TestableService } from "@/features/entertest/queries";
import { ListSearch } from "@/components/common/ListSearch";
import { ListSelect } from "@/components/common/ListSelect";

const PAGE_SIZE = 30;

/**
 * dev-test 좌측 서비스 목록.
 * 클라이언트 필터(category / region / university_type / admission_type) + 검색 + 페이지네이션.
 */
export function DevTestList({
  services,
  selectedId,
  onSelect,
}: {
  services: TestableService[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [universityType, setUniversityType] = useState("");
  const [admissionType, setAdmissionType] = useState("");
  const [page, setPage] = useState(1);

  // 각 필터 옵션 — distinct sorted (null 제외)
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(services.map((s) => s.category).filter((v): v is string => v !== null)),
      ).sort(),
    [services],
  );
  const regionOptions = useMemo(
    () =>
      Array.from(
        new Set(services.map((s) => s.region).filter((v): v is string => v !== null)),
      ).sort(),
    [services],
  );
  const universityTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          services.map((s) => s.university_type).filter((v): v is string => v !== null),
        ),
      ).sort(),
    [services],
  );
  const admissionTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          services.map((s) => s.admission_type).filter((v): v is string => v !== null),
        ),
      ).sort(),
    [services],
  );

  const filtered = useMemo(() => {
    const lower = q.toLowerCase();
    return services.filter((s) => {
      if (category && s.category !== category) return false;
      if (region && s.region !== region) return false;
      if (universityType && s.university_type !== universityType) return false;
      if (admissionType && s.admission_type !== admissionType) return false;
      if (
        lower &&
        !s.university_name.toLowerCase().includes(lower) &&
        !s.service_name.toLowerCase().includes(lower)
      )
        return false;
      return true;
    });
  }, [services, q, category, region, universityType, admissionType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleFilterChange<T>(setter: (v: T) => void, val: T) {
    setter(val);
    setPage(1);
  }

  return (
    <div className="flex h-full flex-col border border-line bg-paper">
      {/* 필터 툴바 */}
      <div className="flex flex-col gap-2 border-b border-line-soft px-3 py-2">
        <ListSearch
          value={q}
          onChange={(v) => handleFilterChange(setQ, v)}
          placeholder="대학명·서비스명 검색"
          ariaLabel="서비스 검색"
        />
        <div className="flex flex-wrap gap-1">
          <ListSelect
            value={category}
            onChange={(v) => handleFilterChange(setCategory, v)}
            options={categoryOptions}
            placeholder="카테고리 전체"
            ariaLabel="카테고리 필터"
          />
          <ListSelect
            value={region}
            onChange={(v) => handleFilterChange(setRegion, v)}
            options={regionOptions}
            placeholder="지역 전체"
            ariaLabel="지역 필터"
          />
          <ListSelect
            value={universityType}
            onChange={(v) => handleFilterChange(setUniversityType, v)}
            options={universityTypeOptions}
            placeholder="대학구분 전체"
            ariaLabel="대학구분 필터"
          />
          <ListSelect
            value={admissionType}
            onChange={(v) => handleFilterChange(setAdmissionType, v)}
            options={admissionTypeOptions}
            placeholder="전형 전체"
            ariaLabel="전형 필터"
          />
        </div>
      </div>

      {/* 목록 */}
      <ul className="flex-1 divide-y divide-line-soft overflow-y-auto">
        {pageItems.length === 0 ? (
          <li className="px-3 py-8 text-center text-xs text-muted">
            조건에 맞는 서비스가 없습니다.
          </li>
        ) : (
          pageItems.map((s) => {
            const isSelected = s.service_id === selectedId;
            return (
              <li key={s.service_id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.service_id)}
                  className={`w-full cursor-pointer px-3 py-2 text-left transition-colors hover:bg-washi-raised ${
                    isSelected ? "border-l-2 border-vermilion bg-washi-raised" : ""
                  }`}
                >
                  <p className="text-xs font-medium text-ink">
                    {s.university_name} — {s.service_name}
                    <span className="ml-1 text-muted">({s.service_id})</span>
                  </p>
                  <p className="mt-0.5 text-2xs text-muted">
                    {[s.category, s.region, s.operator_name].filter(Boolean).join(" · ")}
                    {s.write_end_at
                      ? ` · 마감 ${s.write_end_at.slice(0, 10)}`
                      : ""}
                  </p>
                </button>
              </li>
            );
          })
        )}
      </ul>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between border-t border-line-soft px-3 py-1.5 text-2xs text-muted">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={safePage <= 1}
          className="disabled:opacity-40"
        >
          이전
        </button>
        <span>
          {safePage} / {totalPages}
          <span className="ml-1 text-faint">({filtered.length}건)</span>
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={safePage >= totalPages}
          className="disabled:opacity-40"
        >
          다음
        </button>
      </div>
    </div>
  );
}
