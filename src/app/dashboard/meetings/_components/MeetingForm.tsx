"use client";

import "./meeting-form.css";
import {
  STAMP_STATUSES,
  STAMP_LABELS,
  type MeetingDoc,
  type Section,
  type StampStatus,
} from "@/features/meetings/form-model";

const LETTERS = "ABCDEFGHIJ".split("");

function nextStatus(s: StampStatus): StampStatus {
  const i = STAMP_STATUSES.indexOf(s);
  return STAMP_STATUSES[(i + 1) % STAMP_STATUSES.length];
}

/** 비제어 contentEditable — blur 시에만 값 커밋(커서 점프 방지). */
function Editable({
  value,
  onCommit,
  className,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      className={className}
      data-ph={placeholder}
      onBlur={(e) => {
        const v = e.currentTarget.textContent ?? "";
        if (v !== value) onCommit(v);
      }}
    >
      {value}
    </div>
  );
}

function gridCols(headers: string[], idx: boolean, status: boolean): string {
  return headers
    .map((_, i) => {
      if (idx && i === 0) return "46px";
      if (status && i === headers.length - 1) return "96px";
      return "1fr";
    })
    .join(" ");
}

export function MeetingForm({
  doc,
  onChange,
  masthead,
}: {
  doc: MeetingDoc;
  onChange: (doc: MeetingDoc) => void;
  /** 마스트헤드(유형/제목/일시·장소·참석자) — 워크스페이스에서 메타 편집 주입 */
  masthead?: {
    typeLabel: string;
    saveLabel?: string;
    statusLabel?: string;
    statusDraft?: boolean;
    title: string;
    onTitle: (v: string) => void;
    dateValue: string;
    location: string;
    attendees: string;
    onDate: (v: string) => void;
    onLocation: (v: string) => void;
    onAttendees: (v: string) => void;
    onMetaBlur: () => void;
  };
}) {
  // 섹션 i를 patch한 새 doc 전달
  const patchSection = (i: number, sec: Section) =>
    onChange({ ...doc, sections: doc.sections.map((s, j) => (j === i ? sec : s)) });

  const renderBody = (sec: Section, si: number) => {
    switch (sec.kind) {
      case "table": {
        const cols = gridCols(sec.headers, sec.idx, sec.status);
        const dataCols = sec.headers.filter(
          (_, i) =>
            !(sec.idx && i === 0) && !(sec.status && i === sec.headers.length - 1),
        ).length;
        return (
          <>
          <div className="register">
            <div className="reg-row head" style={{ gridTemplateColumns: cols }}>
              {sec.headers.map((h, i) => (
                <div key={i} className={`rc${sec.idx && i === 0 ? " idx" : ""}`}>
                  {h}
                </div>
              ))}
            </div>
            {sec.rows.map((r, ri) => {
              let ci = 0;
              return (
                <div
                  key={ri}
                  className="reg-row"
                  style={{ gridTemplateColumns: cols }}
                >
                  {sec.headers.map((_, i) => {
                    if (sec.idx && i === 0)
                      return (
                        <div key={i} className="rc idx">
                          {String(ri + 1).padStart(2, "0")}
                        </div>
                      );
                    if (sec.status && i === sec.headers.length - 1) {
                      const st = r.status ?? "talk";
                      return (
                        <div
                          key={i}
                          className={`rc stat st-${st}`}
                          onClick={() => {
                            const rows = sec.rows.map((row, k) =>
                              k === ri ? { ...row, status: nextStatus(st) } : row,
                            );
                            patchSection(si, { ...sec, rows });
                          }}
                        >
                          {STAMP_LABELS[st]}
                        </div>
                      );
                    }
                    const cellIdx = ci;
                    ci += 1;
                    return (
                      <Editable
                        key={i}
                        className="rc"
                        value={r.cells[cellIdx] ?? ""}
                        onCommit={(v) => {
                          const rows = sec.rows.map((row, k) =>
                            k === ri
                              ? {
                                  ...row,
                                  cells: row.cells.map((c, m) =>
                                    m === cellIdx ? v : c,
                                  ),
                                }
                              : row,
                          );
                          patchSection(si, { ...sec, rows });
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="addrow left">
            <button
              type="button"
              className="addbtn"
              onClick={() =>
                patchSection(si, {
                  ...sec,
                  rows: [
                    ...sec.rows,
                    {
                      cells: Array.from({ length: dataCols }, () => ""),
                      status: sec.status ? "talk" : undefined,
                    },
                  ],
                })
              }
            >
              ＋ 행 추가
            </button>
          </div>
          </>
        );
      }
      case "ledger":
        return (
          <>
          <div className="ledger">
            {sec.stations.map((st, sti) => (
              <div key={sti} className="agenda-block">
                <div className="station">
                  <span>
                    <i className="sn mono">{String(sti + 1).padStart(2, "0")}</i>
                    <Editable
                      className="mono"
                      placeholder="안건 제목"
                      value={st.title}
                      onCommit={(v) => {
                        const stations = sec.stations.map((s, k) =>
                          k === sti ? { ...s, title: v } : s,
                        );
                        patchSection(si, { ...sec, stations });
                      }}
                    />
                  </span>
                </div>
                <div className="thr-holder">
                  {st.threads.map((th, ti) => (
                    <div key={ti} className="thread">
                      <div className="node">
                        {sti + 1}·{ti + 1}
                      </div>
                      <div className="ex q">
                        <div className="card">
                          <span className="who">대학 · 질문</span>
                          <Editable
                            className="body"
                            placeholder="논의·질문 내용"
                            value={th.q}
                            onCommit={(v) => {
                              const stations = sec.stations.map((s, k) =>
                                k === sti
                                  ? {
                                      ...s,
                                      threads: s.threads.map((t, m) =>
                                        m === ti ? { ...t, q: v } : t,
                                      ),
                                    }
                                  : s,
                              );
                              patchSection(si, { ...sec, stations });
                            }}
                          />
                          <span
                            className={`stamp st-${th.status}`}
                            onClick={() => {
                              const stations = sec.stations.map((s, k) =>
                                k === sti
                                  ? {
                                      ...s,
                                      threads: s.threads.map((t, m) =>
                                        m === ti
                                          ? { ...t, status: nextStatus(t.status) }
                                          : t,
                                      ),
                                    }
                                  : s,
                              );
                              patchSection(si, { ...sec, stations });
                            }}
                          >
                            {STAMP_LABELS[th.status]}
                          </span>
                        </div>
                      </div>
                      <div className="ex a">
                        <div className="card">
                          <span className="who">진학 · 답변</span>
                          <Editable
                            className="body"
                            placeholder="답변·결정 내용"
                            value={th.a}
                            onCommit={(v) => {
                              const stations = sec.stations.map((s, k) =>
                                k === sti
                                  ? {
                                      ...s,
                                      threads: s.threads.map((t, m) =>
                                        m === ti ? { ...t, a: v } : t,
                                      ),
                                    }
                                  : s,
                              );
                              patchSection(si, { ...sec, stations });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="addrow">
                    <button
                      type="button"
                      className="addbtn"
                      onClick={() => {
                        const stations = sec.stations.map((s, k) =>
                          k === sti
                            ? {
                                ...s,
                                threads: [
                                  ...s.threads,
                                  { q: "", a: "", status: "talk" as StampStatus },
                                ],
                              }
                            : s,
                        );
                        patchSection(si, { ...sec, stations });
                      }}
                    >
                      ＋ Q&A 추가
                    </button>
                    <button
                      type="button"
                      className="addbtn danger"
                      onClick={() =>
                        patchSection(si, {
                          ...sec,
                          stations: sec.stations.filter((_, k) => k !== sti),
                        })
                      }
                    >
                      안건 삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="addrow">
            <button
              type="button"
              className="addbtn"
              onClick={() =>
                patchSection(si, {
                  ...sec,
                  stations: [
                    ...sec.stations,
                    {
                      title: "",
                      threads: [{ q: "", a: "", status: "talk" }],
                    },
                  ],
                })
              }
            >
              ＋ 안건 추가
            </button>
          </div>
          </>
        );
      case "kv":
        return (
          <div className="kv">
            {sec.boxes.map((b, bi) => (
              <div key={bi} className="kvbox">
                <div className="kh">{b.key}</div>
                <Editable
                  className="kb"
                  value={b.value}
                  onCommit={(v) => {
                    const boxes = sec.boxes.map((x, k) =>
                      k === bi ? { ...x, value: v } : x,
                    );
                    patchSection(si, { ...sec, boxes });
                  }}
                />
              </div>
            ))}
          </div>
        );
      case "notes":
      case "list": {
        const isNotes = sec.kind === "notes";
        return (
          <div>
            <div className={isNotes ? "notes" : "slist"}>
              {sec.items.map((t, ii) => (
                <div key={ii} className={isNotes ? "note" : "sitem"}>
                  <span className={isNotes ? "rev" : "bullet"}>
                    {isNotes ? String(ii + 1).padStart(2, "0") : "•"}
                  </span>
                  <Editable
                    className="tx"
                    placeholder={isNotes ? "비고 / 추가 메모" : "내용 입력"}
                    value={t}
                    onCommit={(v) => {
                      const items = sec.items.map((x, k) => (k === ii ? v : x));
                      patchSection(si, { ...sec, items } as Section);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="addrow left">
              <button
                type="button"
                className="addbtn"
                onClick={() =>
                  patchSection(si, {
                    ...sec,
                    items: [...sec.items, ""],
                  } as Section)
                }
              >
                {isNotes ? "＋ 비고 추가" : "＋ 항목 추가"}
              </button>
            </div>
          </div>
        );
      }
      case "banner":
        return (
          <div className="banner">
            <span className="sev">{sec.sev || "Sev-2"}</span>
            <Editable
              className="btxt"
              placeholder="이슈 한 줄 요약"
              value={sec.text}
              onCommit={(v) => patchSection(si, { ...sec, text: v })}
            />
            <span
              className={`bstat st-${sec.status}`}
              onClick={() =>
                patchSection(si, { ...sec, status: nextStatus(sec.status) })
              }
            >
              {STAMP_LABELS[sec.status]}
            </span>
          </div>
        );
    }
  };

  return (
    <div className="meeting-form">
      <div className="paper">
        <div className="sheet">
          {masthead && (
            <>
              {(masthead.saveLabel || masthead.statusLabel) && (
                <div className="mf-statusbar">
                  <span className="mf-save">{masthead.saveLabel}</span>
                  {masthead.statusLabel && (
                    <span
                      className={`mf-status${masthead.statusDraft ? " draft" : ""}`}
                    >
                      {masthead.statusLabel}
                    </span>
                  )}
                </div>
              )}
              <div className="dispatch">{masthead.typeLabel} 회의록</div>
              <div className="title-wrap">
                <h1>
                  <Editable
                    value={masthead.title}
                    placeholder="제목 없음"
                    onCommit={masthead.onTitle}
                  />
                </h1>
                <div className="dateline">
                  <div className="mf-meta-row">
                    <span className="mf-meta-label">일시</span>
                    <input
                      type="datetime-local"
                      value={masthead.dateValue}
                      onChange={(e) => masthead.onDate(e.target.value)}
                      onBlur={masthead.onMetaBlur}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className="mf-meta-input"
                    />
                  </div>
                  <div className="mf-meta-row">
                    <span className="mf-meta-label">장소</span>
                    <input
                      value={masthead.location}
                      onChange={(e) => masthead.onLocation(e.target.value)}
                      onBlur={masthead.onMetaBlur}
                      placeholder="—"
                      className="mf-meta-input"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
          {doc.titleBlock.length > 0 && (
            <div className="titleblock">
              {doc.titleBlock.map((tb, i) => (
                <div
                  key={i}
                  className={`tb${tb.span === 4 ? " w4" : tb.span === 2 ? " w2" : ""}`}
                >
                  <div className="k">{tb.key}</div>
                  <Editable
                    className="v"
                    value={tb.value}
                    onCommit={(v) =>
                      onChange({
                        ...doc,
                        titleBlock: doc.titleBlock.map((x, k) =>
                          k === i ? { ...x, value: v } : x,
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {doc.sections.map((sec, i) => {
            if (sec.kind === "banner")
              return <div key={i}>{renderBody(sec, i)}</div>;
            // 앞선 non-banner 섹션 개수로 letter 산출 — 렌더 중 변수 재할당 회피(React Compiler).
            const letter =
              LETTERS[
                doc.sections.slice(0, i).filter((s) => s.kind !== "banner")
                  .length
              ] ?? "";
            return (
              <div key={i}>
                <div className="seclabel">
                  <span className="no">{letter}</span>
                  <h2>{sec.title}</h2>
                  <span className="rule" />
                </div>
                {renderBody(sec, i)}
              </div>
            );
          })}

          {doc.approval && (
            <div className="signs">
              <div className="sgrid">
                {["작성", "검토", "승인"].map((h) => (
                  <div key={h} className="sg">
                    <div className="h">{h}</div>
                    <div className="s" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
