// A stand-in for lib/db's `sql` tag. Queries are recorded, and answered by
// the handler a test installs, so server actions run without a database.
export type RecordedQuery = { text: string; values: unknown[] };
export type SqlHandler = (query: RecordedQuery) => unknown[];

let handler: SqlHandler = () => [];
export const executed: RecordedQuery[] = [];

export function onSql(next: SqlHandler) {
  handler = next;
}

export function resetDb() {
  handler = () => [];
  executed.length = 0;
}

class Unsafe {
  constructor(readonly raw: string) {}
}

function build(strings: TemplateStringsArray, values: unknown[]): RecordedQuery {
  let text = strings[0];
  const params: unknown[] = [];
  values.forEach((v, i) => {
    if (v instanceof Unsafe) text += v.raw;
    else {
      params.push(v);
      text += `$${params.length}`;
    }
    text += strings[i + 1];
  });
  return { text: text.replace(/\s+/g, " ").trim(), values: params };
}

function run(query: RecordedQuery): unknown[] {
  executed.push(query);
  return handler(query);
}

type LazyQuery = RecordedQuery & PromiseLike<unknown[]>;

function sqlTag(strings: TemplateStringsArray, ...values: unknown[]): LazyQuery {
  const query = build(strings, values);
  return {
    ...query,
    then(resolve, reject) {
      return Promise.resolve()
        .then(() => run(query))
        .then(resolve, reject);
    },
  };
}

export const sql = Object.assign(sqlTag, {
  unsafe: (raw: string) => new Unsafe(raw),
  async transaction(
    queries: LazyQuery[] | ((tx: typeof sqlTag) => LazyQuery[])
  ): Promise<unknown[][]> {
    const list = typeof queries === "function" ? queries(sqlTag) : queries;
    return list.map((q) => run({ text: q.text, values: q.values }));
  },
});

/** Queries whose text contains every fragment. */
export function executedMatching(...fragments: string[]): RecordedQuery[] {
  return executed.filter((q) => fragments.every((f) => q.text.includes(f)));
}
