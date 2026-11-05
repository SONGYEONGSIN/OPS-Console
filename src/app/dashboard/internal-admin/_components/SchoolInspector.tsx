"use client";

import Link from "next/link";
import { InspectorPanel } from "../../_components/inspector/InspectorPanel";
import { kstFormat } from "@/lib/kst-format";
import { DOC_KINDS } from "@/features/sms-sender/types";
import { stageLabel, type SchoolDetail } from "@/features/sms-sender/filters";
import { viewHref } from "../tabs";
import { markClass, markGlyph } from "./doc-mark";

const NUMBER_LIMIT = 10;
const DATE = kstFormat({ year: "numeric", month: "2-digit", day: "2-digit" });

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <h4 className="mb-2 text-xs uppercase tracking-[0.06em] text-muted">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Body({ detail }: { detail: SchoolDetail }) {
  const { school, numbers, checks } = detail;
  const docs = school.docs;
  const shown = numbers.slice(0, NUMBER_LIMIT);
  const moreHref = `${viewHref("numbers")}&q=${encodeURIComponent(school.name)}&gubun=${encodeURIComponent(school.gubun)}`;
  return (
    <>
      {/* InspectorChrome 과 같은 머리 — 눈썹 문구, 굵은 제목, 굵은 아랫선.
          상태 뱃지·편집 토글은 안 붙인다: 읽기 전용이고 학교에 그 상태가 없다
          (에이전트·전도금 인스펙터와 같은 판단). */}
      <header className="mb-6 border-b-2 border-ink pb-4">
        <div className="space-y-1">
          <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
            인스펙터 · 학교
          </p>
          <h3 className="text-xl font-bold tracking-[-0.01em] text-ink">
            {school.name}
          </h3>
          <p className="text-xs text-muted">
            {school.gubun} · {stageLabel(school)} ·{" "}
            <span className="tabular-nums">회선 {school.lines}</span>
          </p>
        </div>
      </header>

      <Section title="제출 서류">
        {docs ? (
          <>
            <ul className="space-y-1 text-sm">
              {DOC_KINDS.map((k) => {
                const mark = docs.marks[k];
                return (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span
                      aria-label={`${k} ${mark || "없음"}`}
                      title={mark || undefined}
                      className={markClass(mark)}
                    >
                      {markGlyph(mark)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {docs.missing && (
              <p className="mt-2 text-sm text-vermilion">
                미제출: {docs.missing}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">
            _서류 시트에 이 학교 줄이 없습니다
          </p>
        )}
      </Section>

      <Section title="통합 PDF">
        {school.pdfs.length === 0 ? (
          <p className="text-sm text-muted">통합 PDF 없음</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {school.pdfs.map((p) => (
              <li key={p.webUrl}>
                <a
                  href={p.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink underline"
                >
                  통합 PDF 열기 · {p.sub ?? p.stage}
                </a>
                <div className="text-xs tabular-nums text-muted">
                  {DATE.format(new Date(p.lastModifiedDateTime))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="발신번호">
        <ul className="space-y-1 text-sm">
          {shown.map((n) => (
            <li key={n.no} className="flex justify-between gap-2">
              <span className="tabular-nums">{n.number}</span>
              <span className="text-muted">{n.status}</span>
            </li>
          ))}
        </ul>
        {numbers.length > NUMBER_LIMIT && (
          <Link
            href={moreHref}
            className="mt-2 inline-block text-sm text-ink underline"
          >
            발신번호 탭에서 전체 보기 ({numbers.length})
          </Link>
        )}
      </Section>

      <Section title="확인 필요">
        {checks.length === 0 ? (
          <p className="text-sm text-muted">
            이 학교의 확인 필요 항목이 없습니다
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            {checks.map((c) => (
              <li key={c.no}>
                <div className="font-bold">{c.kind}</div>
                <div>{c.content}</div>
                <div className="text-muted">할 일: {c.todo}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

export function SchoolInspector({
  detail,
  onClose,
}: {
  detail: SchoolDetail | null;
  onClose: () => void;
}) {
  return (
    <InspectorPanel open={detail !== null} onClose={onClose}>
      {detail && <Body detail={detail} />}
    </InspectorPanel>
  );
}
