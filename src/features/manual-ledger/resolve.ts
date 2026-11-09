import type {
  ManualFolderFile,
  ManualSource,
  OperatorEntry,
  ResolvedManual,
} from "./types";

type Recipient = { name: string; email: string };

const nameKey = (s: string): string => s.trim().normalize("NFC");

/**
 * 이름 → 운영자. 삭제된 운영자는 뺀다. 같은 이름이 둘 이상 남으면 누구에게
 * 보낼지 모르므로 그 이름은 명부에 없는 것으로 둔다(미확인으로 드러난다).
 */
function directoryOf(operators: OperatorEntry[]): Map<string, Recipient> {
  const byName = new Map<string, Recipient[]>();
  for (const op of operators) {
    if (op.status === "deleted") continue;
    const key = nameKey(op.name);
    byName.set(key, [
      ...(byName.get(key) ?? []),
      { name: key, email: op.email },
    ]);
  }
  return new Map(
    [...byName]
      .filter(([, list]) => list.length === 1)
      .map(([k, list]) => [k, list[0]]),
  );
}

/**
 * 대장 행 → 파일·받는 사람. 파일은 **파일명 정확 일치**로만 찾는다 — 같은 코드의
 * 옛 버전이 같은 폴더에 섞여 있어 코드 접두로 맞추면 엉뚱한 파일이 걸린다.
 */
export function resolveLedger(
  source: ManualSource,
  operators: OperatorEntry[],
): ResolvedManual[] {
  const filesByName = new Map<string, ManualFolderFile>(
    source.files.map((f) => [nameKey(f.name), f]),
  );
  const directory = directoryOf(operators);
  return source.ledger.map((row) => {
    const keys = row.owners.map(nameKey);
    return {
      ...row,
      file: filesByName.get(nameKey(row.docName)) ?? null,
      active: source.activeTasks.has(row.task),
      recipients: keys.flatMap((k) => {
        const hit = directory.get(k);
        return hit ? [hit] : [];
      }),
      unresolvedOwners: keys.filter((k) => !directory.has(k)),
    };
  });
}
