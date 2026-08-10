import { SendReceivablesMailButton } from "@/components/receivables/SendReceivablesMailButton";
import { Section, DefList, Divider } from "../shared";
import { elapsedDays, pickSchoolOwnerEmail } from "./helpers";
import type { ViewProps } from "../types";

export function ReceivablesView({
  row,
  currentUserPermission = null,
  receivablesMailDryRun = true,
}: ViewProps) {
  const canSendMail = currentUserPermission === "admin";
  const mailDryRun = receivablesMailDryRun;
  const cells = row.receivablesCells;
  const elapsed = elapsedDays(row.meta);
  const schoolOwnerEmail = pickSchoolOwnerEmail(cells);
  const isPaidByRemarks = /입금\s*완료/.test(cells?.remarks ?? "");
  return (
    <div className="space-y-6">
      <Section title="기본 정보">
        {/* 발송 여부를 판단하는 근거(경과일수·입금여부)를 읽은 뒤 행동이 오도록
            메일 버튼을 DefList 아래에 둔다. */}
        <div className="space-y-3">
          <DefList
            items={[
              { term: "거래처", desc: row.name || "-" },
              { term: "청구일자", desc: row.meta ?? "-" },
              {
                term: "청구금액",
                desc: <span className="text-ink">{row.author ?? "-"}</span>,
              },
              {
                term: "경과일수",
                desc:
                  elapsed === null ? (
                    <span className="text-muted">-</span>
                  ) : (
                    <span
                      className={
                        row.status === "approved"
                          ? "text-muted"
                          : elapsed >= 60
                            ? "font-medium text-vermilion-deep"
                            : elapsed >= 30
                              ? "text-vermilion"
                              : "text-ink"
                      }
                    >
                      {elapsed}일 경과
                    </span>
                  ),
              },
              {
                term: "입금여부",
                desc: (
                  <span
                    className={`inline-block px-2 py-0.5 text-xs ${
                      row.status === "approved"
                        ? "bg-washi-raised text-ink"
                        : "bg-vermilion/20 text-vermilion-deep"
                    }`}
                  >
                    {row.status === "approved" ? "수금" : "미수"}
                  </span>
                ),
              },
            ]}
          />
          {canSendMail && schoolOwnerEmail && !isPaidByRemarks ? (
            <div className="flex justify-end">
              <SendReceivablesMailButton
                email={schoolOwnerEmail}
                customerName={row.name}
                dryRun={mailDryRun}
              />
            </div>
          ) : null}
        </div>
      </Section>

      {row.body && (
        <>
          <Divider />
          <Section title="거래내역">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {row.body}
            </p>
          </Section>
        </>
      )}

      {cells && cells.headers.length > 0 && (
        <>
          <Divider />
          <Section title="전체 컬럼 (Excel 원본)">
            <DefList
              items={cells.headers.map((h, i) => ({
                term: h,
                desc:
                  cells.textValues[i] !== undefined &&
                  cells.textValues[i] !== ""
                    ? cells.textValues[i]
                    : "—",
              }))}
            />
          </Section>
        </>
      )}
    </div>
  );
}
