import { Client } from 'pg';

// Ground-truth access to the stack's Postgres. We seed and read view_count directly
// in the DB (never via the API) so the measurement is not perturbed by the very
// GET /api/dataentities/{id} call whose effect we are counting.
//
// Id 2001 is distinct from the API-probe P-001's 1001 to avoid any collision.
export const ENTITY_ID = 2001;
const SOURCE_ID = 2001;

const CONN =
  process.env.ODD_DB_URL ??
  'postgresql://odd-platform:odd-platform-password@localhost:15432/odd-platform';

async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: CONN });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Seed a fresh, renderable data entity with view_count = 0 — the same minimal column
// set the API probe P-001 uses, sufficient for GET /api/dataentities/{id} (which the
// Overview page calls) to return 200 and increment the counter. DO UPDATE resets the
// count to 0 so the spec is re-runnable against an external (ODD_STACK_EXTERNAL) stack.
export async function seedEntity(): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO data_source (id, oddrn, name)
       VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [SOURCE_ID, '//e2e-source-IT-002/db', 'e2e-source-IT-002'],
    );
    await c.query(
      `INSERT INTO data_entity
         (id, oddrn, external_name, data_source_id, type_id, view_count,
          source_created_at, source_updated_at)
       VALUES ($1, $2, $3, $4, 1, 0, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET view_count = 0`,
      [ENTITY_ID, '//e2e-source-IT-002/db/tables/it002_table', 'it002_table', SOURCE_ID],
    );
  });
}

export async function readViewCount(): Promise<number> {
  return withClient(async (c) => {
    const r = await c.query('SELECT view_count FROM data_entity WHERE id = $1', [ENTITY_ID]);
    return Number(r.rows[0]?.view_count ?? -1);
  });
}
