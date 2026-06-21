import "./meeting-form.css";
import { STAMP_LABELS, type MeetingDoc, type Section } from "@/features/meetings/form-model";

const LETTERS = "ABCDEFGHIJ".split("");

/** 표 컬럼 폭 — idx(번호)=46px, status(상태)=96px, 나머지 1fr */
function gridCols(headers: string[], idx: boolean, status: boolean): string {
  return headers
    .map((_, i) => {
      if (idx && i === 0) return "46px";
      if (status && i === headers.length - 1) return "96px";
      return "1fr";
    })
    .join(" ");
}

function TableSection({ sec }: { sec: Extract<Section, { kind: "table" }> }) {
  const cols = gridCols(sec.headers, sec.idx, sec.status);
  return (
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
          <div key={ri} className="reg-row" style={{ gridTemplateColumns: cols }}>
            {sec.headers.map((_, i) => {
              if (sec.idx && i === 0)
                return (
                  <div key={i} className="rc idx">
                    {ri + 1}
                  </div>
                );
              if (sec.status && i === sec.headers.length - 1) {
                const st = r.status ?? "talk";
                return (
                  <div key={i} className={`rc stat st-${st}`}>
                    {STAMP_LABELS[st]}
                  </div>
                );
              }
              const v = r.cells[ci] ?? "";
              ci += 1;
              return (
                <div key={i} className="rc">
                  {v}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function LedgerSection({ sec }: { sec: Extract<Section, { kind: "ledger" }> }) {
  return (
    <div className="ledger">
      {sec.stations.map((st, si) => (
        <div key={si} className="agenda-block">
          <div className="station">
            <span>
              <i className="sn mono">{String(si + 1).padStart(2, "0")}</i>
              <b style={{ fontWeight: 800 }}>{st.title}</b>
            </span>
          </div>
          <div className="thr-holder">
            {st.threads.map((th, ti) => (
              <div key={ti} className="thread">
                <div className="node">
                  {si + 1}·{ti + 1}
                </div>
                <div className="ex q">
                  <div className="card">
                    <span className="who">대학 · 질문</span>
                    <div className="body">{th.q}</div>
                    <span className={`stamp st-${th.status}`}>
                      {STAMP_LABELS[th.status]}
                    </span>
                  </div>
                </div>
                <div className="ex a">
                  <div className="card">
                    <span className="who">진학 · 답변</span>
                    <div className="body">{th.a}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionBody({ sec }: { sec: Section }) {
  switch (sec.kind) {
    case "table":
      return <TableSection sec={sec} />;
    case "ledger":
      return <LedgerSection sec={sec} />;
    case "kv":
      return (
        <div className="kv">
          {sec.boxes.map((b, i) => (
            <div key={i} className="kvbox">
              <div className="kh">{b.key}</div>
              <div className="kb">{b.value}</div>
            </div>
          ))}
        </div>
      );
    case "notes":
      return (
        <div className="notes">
          {sec.items.map((t, i) => (
            <div key={i} className="note">
              <span className="rev" />
              <div className="tx">{t}</div>
            </div>
          ))}
        </div>
      );
    case "list":
      return (
        <div className="slist">
          {sec.items.map((t, i) => (
            <div key={i} className="sitem">
              <span className="bullet">•</span>
              <div className="tx">{t}</div>
            </div>
          ))}
        </div>
      );
    case "banner":
      return (
        <div className="banner">
          <span className="sev">{sec.sev || "Sev-2"}</span>
          <div className="btxt">{sec.text}</div>
          <span className={`bstat st-${sec.status}`}>{STAMP_LABELS[sec.status]}</span>
        </div>
      );
  }
}

/**
 * 회의록 v2 양식 읽기전용 렌더러 (운영팀 HTML 양식). 편집 인터랙션은 PR4에서.
 * banner 섹션은 seclabel 없이 단독 렌더(긴급 양식 상단 띠).
 */
export function MeetingFormDoc({
  doc,
  title,
  typeLabel,
  dateValue,
  location,
  attendees,
}: {
  doc: MeetingDoc;
  title: string;
  typeLabel: string;
  dateValue: string;
  location: string;
  attendees: string[];
}) {
  let letterIdx = 0;
  return (
    <div className="meeting-form">
      <div className="paper">
        <div className="sheet">
          <div className="dispatch">{typeLabel} 회의록</div>
          <div className="title-wrap">
            <h1>{title || "제목 없음"}</h1>
            <div className="dateline">
              <div>
                일시 <b>{dateValue || "—"}</b>
              </div>
              <div>
                장소 <b>{location || "—"}</b>
              </div>
              <div>
                참석 <b>{attendees.length > 0 ? attendees.join(", ") : "—"}</b>
              </div>
            </div>
          </div>

          {doc.titleBlock.length > 0 && (
            <div className="titleblock">
              {doc.titleBlock.map((tb, i) => (
                <div
                  key={i}
                  className={`tb${tb.span === 4 ? " w4" : tb.span === 2 ? " w2" : ""}`}
                >
                  <div className="k">{tb.key}</div>
                  <div className="v">{tb.value}</div>
                </div>
              ))}
            </div>
          )}

          {doc.sections.map((sec, i) => {
            if (sec.kind === "banner")
              return <SectionBody key={i} sec={sec} />;
            const letter = LETTERS[letterIdx] ?? "";
            letterIdx += 1;
            return (
              <div key={i}>
                <div className="seclabel">
                  <span className="no">{letter}</span>
                  <h2>{sec.title}</h2>
                  <span className="rule" />
                </div>
                <SectionBody sec={sec} />
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
