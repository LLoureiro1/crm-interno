import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');

const databaseUrl =
  process.env.SMOKE_TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const bootstrapFiles = [
  'tests/smoke/sql/ci/01_minimal_schema.sql',
  'tests/smoke/sql/ci/02_validate_cpf.sql',
  'supabase/migrations/20260629130000_smoke_test_schema.sql',
  'supabase/migrations/20260629140000_smoke_test_password_access.sql',
  'supabase/migrations/20260608150000_fix_engagement_student_emails_only.sql',
  'supabase/migrations/20260609120000_engagement_recency_tiers.sql',
];

const sql = postgres(databaseUrl, { max: 1, idle_timeout: 5 });

try {
  for (const relativePath of bootstrapFiles) {
    const absolutePath = join(repoRoot, relativePath);
    const body = await readFile(absolutePath, 'utf8');
    console.log(`→ ${relativePath}`);
    await sql.unsafe(body);
  }
  console.log('Bootstrap de smoke tests aplicado.');
} finally {
  await sql.end();
}
