import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const casesDir = join(__dirname, 'cases');

const databaseUrl =
  process.env.SMOKE_TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const sql = postgres(databaseUrl, { max: 1, idle_timeout: 5 });

async function ensureHarness() {
  const [{ exists }] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.schemata WHERE schema_name = 'smoke_test'
    ) AS exists
  `;
  if (!exists) {
    throw new Error(
      'Schema smoke_test ausente. Rode: supabase db reset (local) ou aplique a migration 20260629130000_smoke_test_schema.sql'
    );
  }
}

async function runCase(file) {
  const suite = file.replace(/\.sql$/, '');
  const body = await readFile(join(casesDir, file), 'utf8');
  const started = Date.now();
  try {
    await sql.unsafe(body);
    const duration_ms = Date.now() - started;
    await sql`SELECT smoke_test.record_run(${suite}, true, NULL, ${duration_ms})`;
    return { suite, passed: true, duration_ms };
  } catch (err) {
    const duration_ms = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    await sql`SELECT smoke_test.record_run(${suite}, false, ${message}, ${duration_ms})`;
    return { suite, passed: false, message, duration_ms };
  }
}

const files = (await readdir(casesDir))
  .filter((f) => f.endsWith('.sql'))
  .sort();

await ensureHarness();

const results = [];
for (const file of files) {
  results.push(await runCase(file));
}

await sql.end();

const failed = results.filter((r) => !r.passed);
for (const r of results) {
  const icon = r.passed ? '✓' : '✗';
  console.log(`${icon} ${r.suite} (${r.duration_ms}ms)${r.message ? `: ${r.message}` : ''}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length}/${results.length} smoke test(s) falharam.`);
  process.exit(1);
}

console.log(`\n${results.length}/${results.length} smoke test(s) passaram.`);
