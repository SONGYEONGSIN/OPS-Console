import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Link,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";
import type { ReactNode } from "react";
import {
  HANDOVER_CATEGORIES,
  type HandoverFieldKey,
} from "@/features/handover/categories";
import { isHandoverFieldComplete } from "@/features/handover/completion";

const PRETENDARD_REGULAR = path.join(
  process.cwd(),
  "public",
  "fonts",
  "Pretendard-Regular.ttf",
);
const PRETENDARD_BOLD = path.join(
  process.cwd(),
  "public",
  "fonts",
  "Pretendard-Bold.otf",
);

let fontRegistered = false;
function ensureFontRegistered() {
  if (fontRegistered) return;
  Font.register({
    family: "Pretendard",
    fonts: [
      { src: PRETENDARD_REGULAR, fontWeight: 400 },
      { src: PRETENDARD_BOLD, fontWeight: 700 },
    ],
  });
  fontRegistered = true;
}

export type HandoverPdfFields = Record<HandoverFieldKey, string | null>;

export type HandoverPdfInput = {
  universityName: string;
  serviceName: string;
  applicationType: string;
  fromName: string;
  fromEmail: string;
  toName: string;
  toEmail: string;
  notes: string | null;
  createdAt: string;
  fields: HandoverPdfFields;
  /** 계약정보 구조화 폼 (제목/형태/진행/상태/메모) */
  contractInfo?: {
    title: string;
    type: string;
    progress: string;
    status: string;
    memo: string;
  };
  /** 계약자료 체크리스트 (계약서류) */
  contractChecklist?: { text: string; done: boolean }[];
  /** 서류 체크리스트 (제출서류) */
  docsChecklist?: { text: string; done: boolean }[];
  /** 학교담당자 구조화 연락처 (컨텍) */
  schoolContacts?: {
    name: string;
    jobTitle: string | null;
    phone: string | null;
    email: string | null;
  }[];
  /** 정산 — 전형료 구조화 폼 */
  paymentFee?: { deadline: string; manager: string; memo: string };
  /** 정산 — 계산서 구조화 폼 */
  paymentInvoice?: { issueType: string; memo: string };
};

// react-pdf StyleSheet은 Tailwind/토큰 클래스를 쓸 수 없어 리터럴 색상이 불가피하다.
// 프로젝트 디자인 토큰 값과 동일하게 유지 (design-tokens: vermilion/ink/washi/sage 등).
const C = {
  vermilion: "#b8331e",
  vermilionDeep: "#8e2412",
  ink: "#1a1712",
  muted: "#8a8175",
  faint: "#b8b0a2",
  washi: "#ede6d2",
  washiRaised: "#f4eddd",
  paper: "#fbf7f0",
  line: "#e2dac9",
  sage: "#5c7346",
  white: "#ffffff",
  linkBlue: "#2352c9",
  barTrack: "#e0d5bf",
};

const RAIL_W = 150;

const styles = StyleSheet.create({
  page: {
    fontFamily: "Pretendard",
    fontSize: 10,
    color: C.ink,
    paddingLeft: 0,
    paddingRight: 34,
    paddingTop: 0,
    paddingBottom: 34,
    lineHeight: 1.6,
  },
  // 좌측 목차 레일 — 모든 페이지 반복(fixed), 내용이 여러 페이지로 넘어가도 유지
  rail: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: RAIL_W,
    backgroundColor: C.paper,
    borderRightWidth: 1,
    borderRightColor: C.line,
    paddingTop: 26,
    paddingHorizontal: 16,
  },
  railCap: {
    fontSize: 8,
    letterSpacing: 1.6,
    color: C.faint,
    fontWeight: 700,
    marginBottom: 10,
  },
  tocRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  tocRowBorder: { borderTopWidth: 1, borderTopColor: C.line },
  tocName: { fontSize: 10, fontWeight: 700, color: C.ink },
  tocNo: { color: C.faint, fontWeight: 700 },
  chipOk: {
    fontSize: 7,
    fontWeight: 700,
    color: C.white,
    backgroundColor: C.sage,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 7,
  },
  chipPartial: {
    fontSize: 7,
    fontWeight: 700,
    color: C.muted,
    backgroundColor: C.washiRaised,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 7,
  },
  railMemo: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  railCap2: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: C.faint,
    fontWeight: 700,
    marginBottom: 4,
  },
  railMemoText: { fontSize: 9, color: C.ink, lineHeight: 1.55 },

  // 우측 본문
  main: { marginLeft: RAIL_W },
  band: {
    backgroundColor: C.vermilion,
    paddingVertical: 18,
    paddingHorizontal: 22,
  },
  brand: {
    fontSize: 8,
    letterSpacing: 2,
    color: C.white,
    opacity: 0.85,
    marginBottom: 8,
  },
  bandTitle: { fontSize: 21, fontWeight: 700, color: C.white },
  bandSub: { fontSize: 10.5, color: C.white, opacity: 0.92, marginTop: 6 },

  meta: {
    backgroundColor: C.washi,
    paddingVertical: 13,
    paddingHorizontal: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaFields: { flexDirection: "row", flexShrink: 1 },
  metaCol: { marginRight: 22 },
  metaRow: { flexDirection: "row", marginBottom: 4 },
  metaKey: { fontSize: 9, color: C.muted, width: 46 },
  metaVal: { fontSize: 9, color: C.ink },
  prog: { alignItems: "flex-end", flexShrink: 0, marginLeft: 12 },
  progNum: { fontSize: 18, fontWeight: 700, color: C.vermilionDeep },
  progLabel: { fontSize: 8, color: C.muted, marginTop: 2 },
  progBar: {
    width: 130,
    height: 6,
    backgroundColor: C.barTrack,
    borderRadius: 3,
    marginTop: 6,
  },
  progBarFill: { height: 6, backgroundColor: C.sage, borderRadius: 3 },

  sections: { paddingHorizontal: 22, paddingTop: 18 },
  section: { marginBottom: 18 },
  // 카테고리 헤더 — 두꺼운 밑줄, break 시 헤더만 외롭게 남지 않도록 minPresenceAhead
  secHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2.5,
    borderBottomColor: C.vermilion,
    paddingBottom: 5,
    marginBottom: 8,
  },
  secTitle: { fontSize: 12.5, fontWeight: 700, color: C.vermilion },
  secCount: { fontSize: 8.5, color: C.muted },

  field: {
    flexDirection: "row",
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: C.washiRaised,
  },
  fieldFirst: { borderTopWidth: 0 },
  fieldKey: { width: 72, fontSize: 9, fontWeight: 700, color: C.vermilionDeep },
  fieldVal: { flex: 1, fontSize: 10, lineHeight: 1.7 },
  empty: { fontSize: 9, color: C.faint },

  kvline: { flexDirection: "row", marginBottom: 2 },
  kvKey: { width: 40, fontSize: 10, color: C.muted, fontWeight: 700 },
  kvVal: { flex: 1, fontSize: 10, color: C.ink },

  valLine: { fontSize: 10, color: C.ink },
  memoLine: { fontSize: 10, color: C.muted, marginTop: 3 },
  chkLine: { fontSize: 10, color: C.ink, marginBottom: 1 },
  chkDone: { color: C.sage, fontWeight: 700 },
  chkTodo: { color: C.faint },
  pplLine: { fontSize: 10, color: C.ink, marginBottom: 2 },
  pplDim: { color: C.muted },
  link: { color: C.linkBlue, textDecoration: "underline" },

  // 모든 페이지 하단 고정
  footer: {
    position: "absolute",
    bottom: 16,
    left: RAIL_W,
    right: 0,
    paddingHorizontal: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: C.muted,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: C.line,
  },
});

/**
 * 텍스트 내 http(s) URL을 클릭 가능한 Link로 변환 + 들여쓰기 보존 (PDF).
 * react-pdf는 줄 선두 공백을 접으므로 각 줄 선두의 공백/탭을 유지한다.
 */
function linkify(text: string): ReactNode {
  const preserved = text.replace(/^[ \t]+/gm, (m) =>
    " ".repeat(m.replace(/\t/g, "    ").length),
  );
  return preserved.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <Link key={i} src={part} style={styles.link}>
        {part}
      </Link>
    ) : (
      part
    ),
  );
}

function formatYmd(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 필드 값 영역 렌더 — 구조화 필드(계약정보/체크리스트/컨텍/정산)별 분기 */
function fieldChildren(
  key: HandoverFieldKey,
  input: HandoverPdfInput,
): ReactNode {
  const empty = <Text style={styles.empty}>(미작성)</Text>;

  if (key === "contract_info_md") {
    const ci = input.contractInfo;
    const rows = ci
      ? (
          [
            ["제목", ci.title],
            ["형태", ci.type],
            ["진행", ci.progress],
            ["상태", ci.status],
          ] as [string, string][]
        ).filter(([, v]) => v && v.trim())
      : [];
    if (rows.length === 0 && !ci?.memo?.trim()) return empty;
    return (
      <>
        {rows.map(([k, v], i) => (
          <View key={i} style={styles.kvline}>
            <Text style={styles.kvKey}>{k}</Text>
            <Text style={styles.kvVal}>{v}</Text>
          </View>
        ))}
        {ci?.memo?.trim() ? (
          <Text style={styles.memoLine}>{linkify(ci.memo)}</Text>
        ) : null}
      </>
    );
  }

  if (key === "contract_data_md" || key === "docs_md") {
    const list =
      (key === "contract_data_md"
        ? input.contractChecklist
        : input.docsChecklist) ?? [];
    const memo = (input.fields[key] ?? "").trim();
    if (list.length === 0 && !memo) return empty;
    return (
      <>
        {list.map((it, i) => (
          <Text key={i} style={styles.chkLine}>
            <Text style={it.done ? styles.chkDone : styles.chkTodo}>
              {it.done ? "✓" : "○"}
            </Text>{" "}
            {it.text}
          </Text>
        ))}
        {memo ? <Text style={styles.memoLine}>{linkify(memo)}</Text> : null}
      </>
    );
  }

  if (key === "school_contact_md") {
    const list = input.schoolContacts ?? [];
    if (list.length === 0) return empty;
    return (
      <>
        {list.map((c, i) => (
          <Text key={i} style={styles.pplLine}>
            {c.name}
            <Text style={styles.pplDim}>
              {c.jobTitle ? ` (${c.jobTitle})` : ""}
              {c.phone ? ` · ${c.phone}` : ""}
              {c.email ? ` · ${c.email}` : ""}
            </Text>
          </Text>
        ))}
      </>
    );
  }

  if (key === "payment_fee_md") {
    const p = input.paymentFee;
    const head = p
      ? [
          p.deadline && `정산기한 ${p.deadline}`,
          p.manager && `담당 ${p.manager}`,
        ]
          .filter(Boolean)
          .join(" · ")
      : "";
    if (!head && !p?.memo?.trim()) return empty;
    return (
      <>
        {head ? <Text style={styles.valLine}>{head}</Text> : null}
        {p?.memo?.trim() ? (
          <Text style={styles.memoLine}>{linkify(p.memo)}</Text>
        ) : null}
      </>
    );
  }

  if (key === "payment_invoice_md") {
    const p = input.paymentInvoice;
    if (!p?.issueType && !p?.memo?.trim()) return empty;
    return (
      <>
        {p?.issueType ? (
          <Text style={styles.valLine}>{p.issueType}</Text>
        ) : null}
        {p?.memo?.trim() ? (
          <Text style={styles.memoLine}>{linkify(p.memo)}</Text>
        ) : null}
      </>
    );
  }

  const text = (input.fields[key] ?? "").trim();
  return text ? <Text style={styles.valLine}>{linkify(text)}</Text> : empty;
}

function HandoverDocument(input: HandoverPdfInput) {
  // 완료 판정 데이터 — 인스펙터/서버와 동일 규칙(completion.ts) 재사용
  const completionData = {
    ...input.fields,
    contract_info: input.contractInfo ?? null,
    contract_data_checklist: input.contractChecklist ?? null,
    docs_checklist: input.docsChecklist ?? null,
    payment_fee: input.paymentFee ?? null,
    payment_invoice: input.paymentInvoice ?? null,
    school_contacts: input.schoolContacts ?? null,
  };

  const cats = HANDOVER_CATEGORIES.map((cat) => {
    const total = cat.fields.length;
    const filled = cat.fields.filter((f) =>
      isHandoverFieldComplete(completionData, f.key),
    ).length;
    return { cat, total, filled, complete: total > 0 && filled === total };
  });
  const completeCount = cats.filter((c) => c.complete).length;
  const totalCats = cats.length;
  const pct = totalCats ? Math.round((completeCount / totalCats) * 100) : 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* fixed 좌측 목차 레일 — 모든 페이지 */}
        <View fixed style={styles.rail}>
          <Text style={styles.railCap}>목차</Text>
          {cats.map(({ cat, filled, total, complete }, i) => (
            <View
              key={cat.key}
              style={
                i === 0 ? styles.tocRow : [styles.tocRow, styles.tocRowBorder]
              }
            >
              <Text style={styles.tocName}>
                <Text style={styles.tocNo}>
                  {String(i + 1).padStart(2, "0")}{" "}
                </Text>
                {cat.label}
              </Text>
              <Text style={complete ? styles.chipOk : styles.chipPartial}>
                {filled}/{total}
              </Text>
            </View>
          ))}
          {input.notes?.trim() ? (
            <View style={styles.railMemo}>
              <Text style={styles.railCap2}>인계 메모</Text>
              <Text style={styles.railMemoText}>{input.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* 우측 본문 */}
        <View style={styles.main}>
          <View style={styles.band}>
            <Text style={styles.brand}>운영부 상황실 · 인수인계</Text>
            <Text style={styles.bandTitle}>인수인계 확인서</Text>
            <Text style={styles.bandSub}>
              {[input.applicationType, input.universityName, input.serviceName]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>

          <View style={styles.meta}>
            <View style={styles.metaFields}>
              <View style={styles.metaCol}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>인계자</Text>
                  <Text style={styles.metaVal}>
                    {input.fromName} · {input.fromEmail}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>인수자</Text>
                  <Text style={styles.metaVal}>
                    {input.toName} · {input.toEmail}
                  </Text>
                </View>
              </View>
              <View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>접수구분</Text>
                  <Text style={styles.metaVal}>{input.applicationType}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>발송일</Text>
                  <Text style={styles.metaVal}>
                    {formatYmd(input.createdAt)}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.prog}>
              <Text style={styles.progNum}>
                {completeCount} / {totalCats}
              </Text>
              <Text style={styles.progLabel}>영역 작성 완료</Text>
              <View style={styles.progBar}>
                <View style={[styles.progBarFill, { width: `${pct}%` }]} />
              </View>
            </View>
          </View>

          <View style={styles.sections}>
            {cats.map(({ cat, filled, total }) => (
              <View key={cat.key} style={styles.section} minPresenceAhead={40}>
                <View style={styles.secHead}>
                  <Text style={styles.secTitle}>{cat.label}</Text>
                  <Text style={styles.secCount}>
                    {filled}/{total}
                  </Text>
                </View>
                {cat.fields.map((f, i) => (
                  <View
                    key={f.key}
                    style={
                      i === 0 ? [styles.field, styles.fieldFirst] : styles.field
                    }
                  >
                    <Text style={styles.fieldKey}>{f.label}</Text>
                    <View style={styles.fieldVal}>
                      {fieldChildren(f.key, input)}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* fixed 하단 — 자동발송 표기 + 페이지 번호 */}
        <View fixed style={styles.footer}>
          <Text>운영부 상황실 자동발송 · 인수 확인은 인수인계 확인 탭에서</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderHandoverPdf(
  input: HandoverPdfInput,
): Promise<Buffer> {
  ensureFontRegistered();
  return await renderToBuffer(<HandoverDocument {...input} />);
}
