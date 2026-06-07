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

export async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: CONN });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Generic escape-hatch for specs that need a seed not yet covered by a named helper
// above. Prefer a named helper when one fits; use this for one-off arrange/read SQL so
// you never have to re-declare the Client boilerplate (or edit this shared file while
// other specs are being authored in parallel). Returns the pg rows.
export async function dbQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return withClient(async (c) => (await c.query(sql, params)).rows as T[]);
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

// IT-014 — F-004 entity description: seed entity 2001 then set (or clear) its internal
// description. internal_description is the user-edited description the Overview renders.
export async function seedEntityDescription(description: string | null): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query('UPDATE data_entity SET internal_description = $2 WHERE id = $1', [ENTITY_ID, description]);
  });
}

// IT-015 — F-019 owners: seed entity 2001 with an owner (name) bound via a role.
// The odd-minimal IMAGE schema can lag source migrations (no owner.is_deleted, and the
// UNIQUE constraints ON CONFLICT needs may be absent), so use constraint-independent
// SELECT-then-INSERT + DELETE-then-INSERT. Idempotent for sequential test seeding.
// NB image schema (verified by inspecting odd-minimal): ownership(id, data_entity_id, owner_id,
// title_id) — the owner's role is a TITLE (title_id), NOT role_id; owner/title use deleted_at
// (no is_deleted) and their name UNIQUE constraints are unreliable → SELECT-then-INSERT.
async function getOrCreateNamed(c: Client, table: 'owner' | 'title' | 'namespace', name: string): Promise<number> {
  const sel = await c.query(`SELECT id FROM ${table} WHERE name = $1 LIMIT 1`, [name]);
  if (sel.rows[0]) return Number(sel.rows[0].id);
  const ins = await c.query(`INSERT INTO ${table} (name) VALUES ($1) RETURNING id`, [name]);
  return Number(ins.rows[0].id);
}

export async function seedEntityOwner(ownerName: string, titleName = 'IT015-title'): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    const ownerId = await getOrCreateNamed(c, 'owner', ownerName);
    const titleId = await getOrCreateNamed(c, 'title', titleName);
    await c.query('DELETE FROM ownership WHERE data_entity_id = $1 AND owner_id = $2', [ENTITY_ID, ownerId]);
    await c.query('INSERT INTO ownership (data_entity_id, owner_id, title_id) VALUES ($1, $2, $3)',
      [ENTITY_ID, ownerId, titleId]);
  });
}

// Negative-path helper: entity 2001 exists but has NO ownership rows.
export async function clearEntityOwners(): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query('DELETE FROM ownership WHERE data_entity_id = $1', [ENTITY_ID]);
  });
}

// IT-016 — F-002 term-to-entity: seed entity 2001 linked to a term (in a namespace).
// Verified image schema: term(id, name, definition, namespace_id, …) ·
// data_entity_to_term(data_entity_id, term_id, is_description_link). Constraint-independent.
export async function seedEntityTerm(
  termName: string,
  definition = 'IT016 term definition',
  namespaceName = 'IT016-ns',
): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    const nsId = await getOrCreateNamed(c, 'namespace', namespaceName);
    const sel = await c.query('SELECT id FROM term WHERE name = $1 AND namespace_id = $2 LIMIT 1', [termName, nsId]);
    const termId = sel.rows[0]
      ? Number(sel.rows[0].id)
      : Number(
          (
            await c.query(
              'INSERT INTO term (name, definition, namespace_id) VALUES ($1, $2, $3) RETURNING id',
              [termName, definition, nsId],
            )
          ).rows[0].id,
        );
    await c.query('DELETE FROM data_entity_to_term WHERE data_entity_id = $1 AND term_id = $2', [ENTITY_ID, termId]);
    await c.query(
      'INSERT INTO data_entity_to_term (data_entity_id, term_id, is_description_link) VALUES ($1, $2, false)',
      [ENTITY_ID, termId],
    );
  });
}

// Negative-path helper: entity 2001 exists but has NO linked terms.
export async function clearEntityTerms(): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query('DELETE FROM data_entity_to_term WHERE data_entity_id = $1', [ENTITY_ID]);
  });
}

// IT-017 — F-013 custom metadata: seed entity 2001 with an INTERNAL (operator-curated)
// custom metadata field + a value, so the Overview's Metadata panel renders the key/value.
// Verified image schema: metadata_field(id, type, name, origin, deleted_at) ·
// metadata_field_value(data_entity_id, metadata_field_id, value, active). The custom
// surface is origin=INTERNAL (EXTERNAL is collector-ingested "predefined"). getOrCreate
// the field by (name, origin) to respect the partial unique index IX_UNIQUE_INTERNAL_NAME,
// then DELETE-then-INSERT the value (composite PK (data_entity_id, metadata_field_id)) so
// the seed is idempotent without relying on ON CONFLICT targets.
export async function seedEntityMetadata(
  fieldName: string,
  value: string,
  type = 'STRING',
): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    const sel = await c.query(
      `SELECT id FROM metadata_field WHERE name = $1 AND origin = 'INTERNAL' LIMIT 1`,
      [fieldName],
    );
    const fieldId = sel.rows[0]
      ? Number(sel.rows[0].id)
      : Number(
          (
            await c.query(
              `INSERT INTO metadata_field (name, type, origin) VALUES ($1, $2, 'INTERNAL') RETURNING id`,
              [fieldName, type],
            )
          ).rows[0].id,
        );
    await c.query(
      'DELETE FROM metadata_field_value WHERE data_entity_id = $1 AND metadata_field_id = $2',
      [ENTITY_ID, fieldId],
    );
    await c.query(
      `INSERT INTO metadata_field_value (data_entity_id, metadata_field_id, value, active)
       VALUES ($1, $2, $3, true)`,
      [ENTITY_ID, fieldId, value],
    );
  });
}

// Negative-path helper: entity 2001 exists but has NO custom metadata values.
export async function clearEntityMetadata(): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query('DELETE FROM metadata_field_value WHERE data_entity_id = $1', [ENTITY_ID]);
  });
}

// IT-018 — F-177 class/type badges on the detail header: set the entity's type_id +
// entity_class_ids so the header renders the (transformed) class short-label + type badge.
// Verified image schema: data_entity.type_id (int) + data_entity.entity_class_ids (int[]).
// Class ids per DataEntityClassDto: DATA_SET=1, DATA_TRANSFORMER=2, DATA_QUALITY_TEST=4, …
// Type ids per DataEntityTypeDto: TABLE=1, JOB=5, MICROSERVICE=13, … The header renders the
// class SHORT label (DATA_SET→'DS' via DataEntityClassLabelMap) + the type name via
// stringFormatted (TABLE→'TABLE'). Pass classIds=[] for an unclassified entity (no class badge).
export async function seedEntityClassType(typeId: number, classIds: number[]): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query('UPDATE data_entity SET type_id = $2, entity_class_ids = $3 WHERE id = $1', [
      ENTITY_ID,
      typeId,
      classIds,
    ]);
  });
}

// IT-021 — F-044 entity status display: set the entity's lifecycle status; the header renders the
// status name as a badge (verbatim uppercase — verified live: STABLE / DEPRECATED). Verified image
// schema: data_entity.status smallint per DataEntityStatusDto — UNASSIGNED=1, DRAFT=2, STABLE=3,
// DEPRECATED=4, DELETED=5 (avoid 5; it soft-deletes/hides the entity).
export async function seedEntityStatus(statusCode: number): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query('UPDATE data_entity SET status = $2 WHERE id = $1', [ENTITY_ID, statusCode]);
  });
}

// IT-023 — dataset structure/columns: seed a column on entity 2001 (a DATASET) so the Structure
// tab (/dataentities/{id}/structure → GET /api/datasets/{id}/structure) renders the column name.
// Verified schema: dataset_version(version, version_hash, dataset_oddrn) + dataset_field(name, oddrn,
// type jsonb, stats jsonb, field_order, is_*) + dataset_structure(dataset_version_id, dataset_field_id)
// link. ⚠ dataset_field.stats MUST be non-null ('{}') — DatasetFieldApiMapper.deserializeStats NPEs
// (HTTP 500) on null stats (latent platform bug; collectors always send stats). Constraint-independent
// DELETE-then-INSERT; idempotent. The entity must be class DATA_SET (entity_class_ids={1}).
const DATASET_ODDRN = '//e2e-source-IT-002/db/tables/it002_table';
export async function seedDatasetColumn(columnName: string): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query(`UPDATE data_entity SET entity_class_ids = '{1}' WHERE id = $1`, [ENTITY_ID]);
    await c.query(
      `DELETE FROM dataset_structure ds USING dataset_version dv
       WHERE ds.dataset_version_id = dv.id AND dv.dataset_oddrn = $1`,
      [DATASET_ODDRN],
    );
    await c.query('DELETE FROM dataset_version WHERE dataset_oddrn = $1', [DATASET_ODDRN]);
    await c.query('DELETE FROM dataset_field WHERE oddrn = $1', [`${DATASET_ODDRN}/columns/${columnName}`]);
    const vid = Number(
      (
        await c.query(
          `INSERT INTO dataset_version (version, version_hash, created_at, dataset_oddrn)
           VALUES (1, $1, NOW(), $2) RETURNING id`,
          [`it023-${columnName}`, DATASET_ODDRN],
        )
      ).rows[0].id,
    );
    const fid = Number(
      (
        await c.query(
          `INSERT INTO dataset_field (name, oddrn, field_order, type, stats, is_primary_key, is_sort_key, is_key, is_value)
           VALUES ($1, $2, 0, $3::jsonb, '{}'::jsonb, false, false, false, false) RETURNING id`,
          [columnName, `${DATASET_ODDRN}/columns/${columnName}`,
            JSON.stringify({ type: 'TYPE_STRING', logical_type: 'varchar', is_nullable: true })],
        )
      ).rows[0].id,
    );
    await c.query('INSERT INTO dataset_structure (dataset_version_id, dataset_field_id) VALUES ($1, $2)', [vid, fid]);
  });
}

// IT-024 — F-012 data entity group membership: seed entity 2001 as a member of a DEG so the Overview
// "Data entity groups" section renders the group name (verbatim — verified live). Verified schema:
// group_entity_relations(group_oddrn, data_entity_oddrn, is_deleted) — membership is by ODDRN. The DEG
// is itself a data_entity (class DATA_ENTITY_GROUP=8, type DAG=17). DELETE-then-INSERT; idempotent.
export async function seedEntityGroupMembership(groupName: string): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    const groupOddrn = `//e2e-source-IT-002/db/groups/${groupName}`;
    await c.query(
      `INSERT INTO data_entity
         (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
          source_created_at, source_updated_at)
       VALUES (2024, $1, $2, $3, 17, '{8}', 0, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, oddrn = EXCLUDED.oddrn, entity_class_ids = '{8}'`,
      [groupOddrn, groupName, SOURCE_ID],
    );
    await c.query('DELETE FROM group_entity_relations WHERE group_oddrn = $1 AND data_entity_oddrn = $2', [
      groupOddrn,
      DATASET_ODDRN,
    ]);
    await c.query(
      'INSERT INTO group_entity_relations (group_oddrn, data_entity_oddrn, is_deleted) VALUES ($1, $2, false)',
      [groupOddrn, DATASET_ODDRN],
    );
  });
}

// Negative-path helper: entity 2001 exists but belongs to NO group.
export async function clearEntityGroupMembership(): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query('DELETE FROM group_entity_relations WHERE data_entity_oddrn = $1', [DATASET_ODDRN]);
  });
}

// IT-025 — F-028 namespace display: the entity Overview shows its namespace (sourced from the
// data source). Verified schema: data_source.namespace_id → namespace(id, name). OverviewGeneral
// renders dataSource.namespace.name VERBATIM (no transform — confirmed in source). SELECT-then-INSERT
// the namespace, UPDATE the data_source; idempotent.
export async function seedEntityNamespace(namespaceName: string): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    const sel = await c.query('SELECT id FROM namespace WHERE name = $1 LIMIT 1', [namespaceName]);
    const nsId = sel.rows[0]
      ? Number(sel.rows[0].id)
      : Number((await c.query('INSERT INTO namespace (name) VALUES ($1) RETURNING id', [namespaceName])).rows[0].id);
    await c.query('UPDATE data_source SET namespace_id = $2 WHERE id = $1', [SOURCE_ID, nsId]);
  });
}

// Negative-path helper: entity 2001 exists but its data source has NO namespace.
export async function clearEntityNamespace(): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query('UPDATE data_source SET namespace_id = NULL WHERE id = $1', [SOURCE_ID]);
  });
}

// IT-028 — F-019 owner management: seed a named owner so the owners management list
// (/management/owners → GET /api/owners) renders it. The list has a "Search owner" box that filters
// server-side on type (debounced onChange). SELECT-then-INSERT; idempotent.
export async function seedOwner(name: string): Promise<void> {
  await withClient(async (c) => {
    const sel = await c.query('SELECT 1 FROM owner WHERE name = $1 LIMIT 1', [name]);
    if (!sel.rows[0]) await c.query('INSERT INTO owner (name) VALUES ($1)', [name]);
  });
}

// IT-029 — F-005 lineage graph: seed an UPSTREAM entity linked to entity 2001 so the Lineage tab
// renders it. Verified schema: lineage(parent_oddrn, child_oddrn, establisher_oddrn, is_deleted) —
// parent→child by ODDRN. The Lineage tab (react-flow) renders node labels as queryable text (verified
// live). The parent is a real data_entity (class DATA_SET) so it resolves as a node.
export async function seedEntityLineage(parentName: string): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query(`UPDATE data_entity SET entity_class_ids = '{1}' WHERE id = $1`, [ENTITY_ID]);
    const parentOddrn = `//e2e-source-IT-002/db/tables/${parentName}`;
    await c.query(
      `INSERT INTO data_entity
         (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
          source_created_at, source_updated_at)
       VALUES (2029, $1, $2, $3, 1, '{1}', 0, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, oddrn = EXCLUDED.oddrn, entity_class_ids = '{1}'`,
      [parentOddrn, parentName, SOURCE_ID],
    );
    await c.query('DELETE FROM lineage WHERE child_oddrn = $1', [DATASET_ODDRN]);
    await c.query(
      'INSERT INTO lineage (parent_oddrn, child_oddrn, establisher_oddrn, is_deleted) VALUES ($1, $2, $1, false)',
      [parentOddrn, DATASET_ODDRN],
    );
  });
}

// Negative-path helper: entity 2001 exists but has NO lineage relations.
export async function clearEntityLineage(): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query('DELETE FROM lineage WHERE child_oddrn = $1 OR parent_oddrn = $1', [DATASET_ODDRN]);
  });
}

// IT-031 — F-178 business name (internal name): set the entity's internal_name; the detail header
// shows internalName || externalName, so a set business name becomes the heading (verbatim — verified
// live), and clearing it falls back to external_name. Verified schema: data_entity.internal_name.
export async function seedEntityBusinessName(name: string | null): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query('UPDATE data_entity SET internal_name = $2 WHERE id = $1', [ENTITY_ID, name]);
  });
}

// IT-032 — F-151 term detail page: seed a term with a definition and RETURN its id (the term detail
// route is /terms/{id}/overview). The detail page renders the term name + definition verbatim (verified
// live). Idempotent: updates the definition if the term exists. Verified schema: term(id, name,
// definition, namespace_id).
export async function seedTermWithDefinition(
  name: string,
  definition: string,
  namespaceName = 'IT032-ns',
): Promise<number> {
  return withClient(async (c) => {
    const nsSel = await c.query('SELECT id FROM namespace WHERE name = $1 LIMIT 1', [namespaceName]);
    const nsId = nsSel.rows[0]
      ? Number(nsSel.rows[0].id)
      : Number((await c.query('INSERT INTO namespace (name) VALUES ($1) RETURNING id', [namespaceName])).rows[0].id);
    const tSel = await c.query('SELECT id FROM term WHERE name = $1 AND namespace_id = $2 LIMIT 1', [name, nsId]);
    if (tSel.rows[0]) {
      const id = Number(tSel.rows[0].id);
      await c.query('UPDATE term SET definition = $2 WHERE id = $1', [id, definition]);
      return id;
    }
    return Number(
      (
        await c.query('INSERT INTO term (name, definition, namespace_id) VALUES ($1, $2, $3) RETURNING id', [
          name,
          definition,
          nsId,
        ])
      ).rows[0].id,
    );
  });
}

// IT-033 — F-002 (term-side reverse view): seed a term linked to entity 2001 and RETURN its id, so the
// term's "Linked entities" tab (/terms/{id}/linked-entities → GET /api/terms/{id}/linked_entities)
// shows the entity. The reverse of IT-016 (entity→term); distinct surface/code path. Idempotent.
export async function seedTermLinkedToEntity(termName: string, namespaceName = 'IT033-ns'): Promise<number> {
  await seedEntity();
  return withClient(async (c) => {
    const nsSel = await c.query('SELECT id FROM namespace WHERE name = $1 LIMIT 1', [namespaceName]);
    const nsId = nsSel.rows[0]
      ? Number(nsSel.rows[0].id)
      : Number((await c.query('INSERT INTO namespace (name) VALUES ($1) RETURNING id', [namespaceName])).rows[0].id);
    const tSel = await c.query('SELECT id FROM term WHERE name = $1 AND namespace_id = $2 LIMIT 1', [termName, nsId]);
    const termId = tSel.rows[0]
      ? Number(tSel.rows[0].id)
      : Number(
          (
            await c.query('INSERT INTO term (name, definition, namespace_id) VALUES ($1, $2, $3) RETURNING id', [
              termName,
              'IT033 linked term',
              nsId,
            ])
          ).rows[0].id,
        );
    await c.query('DELETE FROM data_entity_to_term WHERE data_entity_id = $1 AND term_id = $2', [ENTITY_ID, termId]);
    await c.query(
      'INSERT INTO data_entity_to_term (data_entity_id, term_id, is_description_link) VALUES ($1, $2, false)',
      [ENTITY_ID, termId],
    );
    return termId;
  });
}

// IT-034 — F-155 term query-example linkage: seed a term with a linked query example and RETURN the
// term id, so the term's "Query Examples" tab (/terms/{id}/query-examples → GET /api/terms/{id}/queryexample)
// shows the example. Verified schema: query_example(id, definition, query, …) · query_example_to_term
// (query_example_id, term_id, is_description_link). Idempotent (clears the term's prior link).
export async function seedTermWithQueryExample(
  termName: string,
  definition: string,
  query: string,
  namespaceName = 'IT034-ns',
): Promise<number> {
  return withClient(async (c) => {
    const nsSel = await c.query('SELECT id FROM namespace WHERE name = $1 LIMIT 1', [namespaceName]);
    const nsId = nsSel.rows[0]
      ? Number(nsSel.rows[0].id)
      : Number((await c.query('INSERT INTO namespace (name) VALUES ($1) RETURNING id', [namespaceName])).rows[0].id);
    const tSel = await c.query('SELECT id FROM term WHERE name = $1 AND namespace_id = $2 LIMIT 1', [termName, nsId]);
    const termId = tSel.rows[0]
      ? Number(tSel.rows[0].id)
      : Number(
          (
            await c.query('INSERT INTO term (name, definition, namespace_id) VALUES ($1, $2, $3) RETURNING id', [
              termName,
              'IT034 query-example term',
              nsId,
            ])
          ).rows[0].id,
        );
    await c.query('DELETE FROM query_example_to_term WHERE term_id = $1', [termId]);
    const qeId = Number(
      (await c.query('INSERT INTO query_example (definition, query) VALUES ($1, $2) RETURNING id', [definition, query]))
        .rows[0].id,
    );
    await c.query(
      'INSERT INTO query_example_to_term (query_example_id, term_id, is_description_link) VALUES ($1, $2, false)',
      [qeId, termId],
    );
    return termId;
  });
}

// IT-026 — F-031 data source management: seed a named data source so the management list
// (/management/datasources → GET /api/datasources) renders it. The list shows the source name
// verbatim (verified live). Distinct id so it never collides with the entity-seed source 2001.
export async function seedDataSource(id: number, name: string): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [id, `//e2e-source-${id}/db`, name],
    );
  });
}

// IT-027 — F-014 per-entity alert view: seed an OPEN alert on entity 2001 so the Alerts tab renders
// it. Verified schema: alert(data_entity_oddrn, last_created_at NOT NULL, status_updated_at NOT NULL,
// status smallint [OPEN=1/RESOLVED=2/RESOLVED_AUTOMATICALLY=3], type smallint [BACKWARDS_INCOMPATIBLE
// _SCHEMA=1 "Backwards incompatible schema" / FAILED_DQ_TEST=2 / FAILED_JOB=3 / DISTRIBUTION_ANOMALY=4]).
// ⚠ The alerts list INNER-JOINs alert_chunk — an alert with NO chunk is invisible, so we also seed a
// chunk. The Alerts tab renders the TYPE label verbatim ("Backwards incompatible schema") + status.
export async function seedEntityAlert(description = 'IT027 alert: schema changed'): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query('DELETE FROM alert_chunk ac USING alert a WHERE ac.alert_id = a.id AND a.data_entity_oddrn = $1', [
      DATASET_ODDRN,
    ]);
    await c.query('DELETE FROM alert WHERE data_entity_oddrn = $1', [DATASET_ODDRN]);
    const alertId = Number(
      (
        await c.query(
          `INSERT INTO alert (data_entity_oddrn, last_created_at, status_updated_at, status, type)
           VALUES ($1, NOW(), NOW(), 1, 1) RETURNING id`,
          [DATASET_ODDRN],
        )
      ).rows[0].id,
    );
    await c.query('INSERT INTO alert_chunk (alert_id, created_at, description) VALUES ($1, NOW(), $2)', [
      alertId,
      description,
    ]);
  });
}

// Negative-path helper: entity 2001 exists but has NO alerts.
export async function clearEntityAlerts(): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query('DELETE FROM alert_chunk ac USING alert a WHERE ac.alert_id = a.id AND a.data_entity_oddrn = $1', [
      DATASET_ODDRN,
    ]);
    await c.query('DELETE FROM alert WHERE data_entity_oddrn = $1', [DATASET_ODDRN]);
  });
}

// IT-020 — F-018 entity tag display: seed entity 2001 with a tag chip on the Overview.
// Verified image schema: tag(id, name, important) · tag_to_data_entity(tag_id, data_entity_id,
// external). The tag NAME renders verbatim on the Overview (no transform — verified live).
// getOrCreate the tag (SELECT-then-INSERT by name), DELETE-then-INSERT the link. Idempotent.
export async function seedEntityTag(tagName: string): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    const sel = await c.query('SELECT id FROM tag WHERE name = $1 LIMIT 1', [tagName]);
    const tagId = sel.rows[0]
      ? Number(sel.rows[0].id)
      : Number((await c.query('INSERT INTO tag (name, important) VALUES ($1, false) RETURNING id', [tagName])).rows[0].id);
    await c.query('DELETE FROM tag_to_data_entity WHERE data_entity_id = $1 AND tag_id = $2', [ENTITY_ID, tagId]);
    await c.query('INSERT INTO tag_to_data_entity (tag_id, data_entity_id, external) VALUES ($1, $2, false)', [tagId, ENTITY_ID]);
  });
}

// Negative-path helper: entity 2001 exists but has NO tag links.
export async function clearEntityTags(): Promise<void> {
  await seedEntity();
  await withClient(async (c) => {
    await c.query('DELETE FROM tag_to_data_entity WHERE data_entity_id = $1', [ENTITY_ID]);
  });
}

// IT-019 — F-024 term search (Dictionary /termsearch): seed a term that is FINDABLE by the
// catalog-wide term search. Term search matches `term_search_entrypoint.term_vector` (an FTS
// tsvector), NOT the `term` table directly — a raw term INSERT is INVISIBLE to search. So we
// also seed the entrypoint vector = `to_tsvector('english', name)`. Verified live (2026-06-03):
// POST /api/terms/search {query,filters:{}} → GET /results returns the seeded term (total:1).
// Constraint-independent (SELECT-then-INSERT term + namespace; DELETE-then-INSERT entrypoint).
export async function seedSearchableTerm(
  termName: string,
  namespaceName = 'IT019-ns',
  definition = 'IT019 searchable term',
): Promise<void> {
  await withClient(async (c) => {
    const nsSel = await c.query('SELECT id FROM namespace WHERE name = $1 LIMIT 1', [namespaceName]);
    const nsId = nsSel.rows[0]
      ? Number(nsSel.rows[0].id)
      : Number((await c.query('INSERT INTO namespace (name) VALUES ($1) RETURNING id', [namespaceName])).rows[0].id);

    const tSel = await c.query('SELECT id FROM term WHERE name = $1 AND namespace_id = $2 LIMIT 1', [termName, nsId]);
    const termId = tSel.rows[0]
      ? Number(tSel.rows[0].id)
      : Number(
          (
            await c.query('INSERT INTO term (name, definition, namespace_id) VALUES ($1, $2, $3) RETURNING id', [
              termName,
              definition,
              nsId,
            ])
          ).rows[0].id,
        );

    // FTS entrypoint vector — the surface term search actually queries.
    await c.query('DELETE FROM term_search_entrypoint WHERE term_id = $1', [termId]);
    await c.query(
      `INSERT INTO term_search_entrypoint (term_id, term_vector) VALUES ($1, to_tsvector('english', $2))`,
      [termId, termName],
    );
  });
}

// IT-022 — F-017 catalog search (/search): seed a data entity FINDABLE by the catalog-wide search.
// Catalog search matches `search_entrypoint.data_entity_vector` (FTS tsvector), NOT data_entity
// directly — a raw entity INSERT is INVISIBLE to search (KEY LESSON 3). So we also seed the
// entrypoint vector = to_tsvector('english', name). Verified live: POST /api/search {query,filters:{}}
// → GET /results returns the seeded entity. Uses IT-022-specific ids (2022/2023) so it never clobbers
// the shared entity 2001. type_id=1 (TABLE) + entity_class_ids={1} (DATA_SET) so it is discoverable.
export async function seedSearchableEntity(id: number, name: string): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [SOURCE_ID, '//e2e-source-IT-002/db', 'e2e-source-IT-002'],
    );
    await c.query(
      `INSERT INTO data_entity
         (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count,
          source_created_at, source_updated_at)
       VALUES ($1, $2, $3, $4, 1, '{1}', 0, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET external_name = EXCLUDED.external_name, entity_class_ids = '{1}'`,
      [id, `//e2e-source-IT-022/db/tables/${id}`, name, SOURCE_ID],
    );
    await c.query('DELETE FROM search_entrypoint WHERE data_entity_id = $1', [id]);
    await c.query(
      `INSERT INTO search_entrypoint (data_entity_id, data_entity_vector) VALUES ($1, to_tsvector('english', $2))`,
      [id, name],
    );
  });
}

// ---------------------------------------------------------------------------
// IT-003 — search tsquery poisoning (PLT-090 catalog / PLT-127 dictionary).
//
// The catalog/term search persists the typed query verbatim into the
// `search_facets` session row (no owner binding) and later inlines it into a raw
// `to_tsquery(?)` (JooqFTSHelper.tsQuery, JooqFTSHelper.java:164-168) with NO
// operator escaping. A metacharacter (`(`, `)`, `:`, …) therefore raises Postgres
// 42601 on every later read of that row — a PERSISTENT 500 until the housekeeping
// TTL evicts it. These helpers give the spec ground-truth visibility into what got
// persisted, independent of the UI, so the "persistent" half of the bug is provable
// from the DB and not just inferred from a transient 5xx.
// ---------------------------------------------------------------------------

// The most-recently-touched search session row's stored query (the thing that, when
// it contains a tsquery metacharacter, poisons every subsequent read). Returns null
// if no session has been created yet. `search_facets` columns are id/query_string/
// filters/last_accessed_at — no owner (PLT-090 defect 1), no soft-delete — so
// "most recent by last_accessed_at" is the right key for a single-user e2e run.
// Best-effort: this is EVIDENCE, never the gate, so a schema surprise returns null
// rather than crashing the test (lesson from the deleted_at miss).
export async function latestSearchFacetQuery(): Promise<string | null> {
  try {
    return await withClient(async c => {
      const r = await c.query(
        `SELECT query_string FROM search_facets
         ORDER BY last_accessed_at DESC NULLS LAST
         LIMIT 1`,
      );
      return r.rows[0]?.query_string ?? null;
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// IT-007 — attachment LOCAL-storage durability (LSN-001 / F-027 / PLT-086).
// A data entity to attach a file to (distinct id so it never collides with the
// other specs' seeds). Mirrors IT-002's proven minimal renderable-entity shape.
// ---------------------------------------------------------------------------
export const ATTACH_ENTITY_ID = 2007;
const ATTACH_SOURCE_ID = 2007;

export async function seedAttachmentEntity(): Promise<number> {
  await withClient(async c => {
    await c.query(
      `INSERT INTO data_source (id, oddrn, name)
       VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [ATTACH_SOURCE_ID, '//e2e-source-IT-007/db', 'e2e-source-IT-007'],
    );
    await c.query(
      `INSERT INTO data_entity
         (id, oddrn, external_name, data_source_id, type_id, view_count,
          source_created_at, source_updated_at)
       VALUES ($1, $2, $3, $4, 1, 0, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [ATTACH_ENTITY_ID, '//e2e-source-IT-007/db/tables/it007_table', 'it007_table', ATTACH_SOURCE_ID],
    );
  });
  return ATTACH_ENTITY_ID;
}

// ---------------------------------------------------------------------------
// IT-005 — Top Tags ordering (PLT-026 / F-018 H-001, LSN-019).
//
// `ReactiveTagRepositoryImpl.listMostPopular` paginates by `TAG.ID ASC` BEFORE it
// aggregates usage (ReactiveTagRepositoryImpl.java:147-148): page 1 (size 30) is the
// 30 OLDEST tags by id, and only THEN are those 30 re-ranked by usage. So the
// youngest (highest-id) tags can never reach page 1 — even when they are the most
// used. We seed a catalog where the MOST-USED tags are the YOUNGEST, so a correct
// "most popular" query MUST surface them and the buggy one structurally cannot.
// (The Overview's TopTagsList re-sorts client-side by usedCount, so the only way the
// popular-young tags are missing from the UI is the backend never returning them —
// which is exactly the bug.)
// ---------------------------------------------------------------------------

const IT005_PREFIX = 'it005-';
const TAG_OLD_COUNT = 30; // fills page 1 (size=30) with older, low-use tags
const TAG_POP_COUNT = 5; // youngest + most-used; a correct Top-N MUST include these
const IT005_SOURCE_ID = 2005;

// Seed 30 older low-use tags (lowest ids) + 5 younger high-use tags (highest ids),
// each tag wired to data entities so usage counts diverge: old=1, young=5. Idempotent
// (clears prior `it005-*` tags first) so it is re-runnable against an external stack.
// Returns the names of the youngest, most-popular tags — the ones a correct Top Tags
// MUST show and the buggy ordering drops off page 1.
export async function seedPopularYoungTags(): Promise<string[]> {
  return withClient(async (c) => {
    // idempotent reset (relations first — FK)
    await c.query(
      `DELETE FROM tag_to_data_entity
       WHERE tag_id IN (SELECT id FROM tag WHERE name LIKE $1)`,
      [`${IT005_PREFIX}%`],
    );
    await c.query(`DELETE FROM tag WHERE name LIKE $1`, [`${IT005_PREFIX}%`]);

    // a source + 5 usage-target entities (mirror IT-002's proven minimal entity shape)
    await c.query(
      `INSERT INTO data_source (id, oddrn, name)
       VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [IT005_SOURCE_ID, '//e2e-source-IT-005/db', 'e2e-source-IT-005'],
    );
    const entityIds: number[] = [];
    for (let i = 0; i < TAG_POP_COUNT; i += 1) {
      const id = 20050 + i;
      entityIds.push(id);
      await c.query(
        `INSERT INTO data_entity
           (id, oddrn, external_name, data_source_id, type_id, view_count,
            source_created_at, source_updated_at)
         VALUES ($1, $2, $3, $4, 1, 0, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
        [id, `//e2e-source-IT-005/db/tables/it005_e${i}`, `it005_e${i}`, IT005_SOURCE_ID],
      );
    }

    // 30 OLD tags first (lowest ids), each used by ONE entity → usedCount = 1
    for (let i = 1; i <= TAG_OLD_COUNT; i += 1) {
      const name = `${IT005_PREFIX}old-${String(i).padStart(3, '0')}`;
      const r = await c.query(
        `INSERT INTO tag (name, important) VALUES ($1, false) RETURNING id`,
        [name],
      );
      await c.query(
        `INSERT INTO tag_to_data_entity (tag_id, data_entity_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [r.rows[0].id, entityIds[0]],
      );
    }

    // 5 POPULAR tags LAST (highest ids = youngest), each used by ALL 5 entities → usedCount = 5
    const popNames: string[] = [];
    for (let i = 1; i <= TAG_POP_COUNT; i += 1) {
      const name = `${IT005_PREFIX}POP-${String(i).padStart(3, '0')}`;
      popNames.push(name);
      const r = await c.query(
        `INSERT INTO tag (name, important) VALUES ($1, false) RETURNING id`,
        [name],
      );
      for (const eid of entityIds) {
        await c.query(
          `INSERT INTO tag_to_data_entity (tag_id, data_entity_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [r.rows[0].id, eid],
        );
      }
    }
    return popNames;
  });
}

// IT-035 — F-008 ingestion contract: a raw data_source row the ingestion API resolves
// data_source_oddrn against (avoids the collector-token/session datasource-register path,
// which is a separate promise — UC-11). Distinct id/oddrn so it never collides with other seeds.
export async function seedIngestionDataSource(id: number, oddrn: string, name: string): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO data_source (id, oddrn, name) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET oddrn = EXCLUDED.oddrn, name = EXCLUDED.name`,
      [id, oddrn, name],
    );
  });
}

// IT-035 — F-008: read an ingested entity's ground-truth state by oddrn (existence + the
// `hollow` flag the ingestion mapper maintains — IngestionServiceImpl reads getHollow()).
// Used to verify whether a re-ingest that OMITS an entity destroys/hollows it (UC-13
// data-loss guard). Returns null when the row is absent (hard-deleted).
export async function entityByOddrn(oddrn: string): Promise<{ id: number; hollow: boolean } | null> {
  return withClient(async (c) => {
    const r = await c.query('SELECT id, hollow FROM data_entity WHERE oddrn = $1', [oddrn]);
    return r.rows[0] ? { id: Number(r.rows[0].id), hollow: Boolean(r.rows[0].hollow) } : null;
  });
}

// IT-041 — F-208 staleness: force an entity's last_ingested_at into the past so the staleness signal
// (data_entity.is_stale, computed vs the deployment stale-period) flips. Used to prove the signal works
// without manipulating clocks. Verified column: data_entity.last_ingested_at.
export async function setEntityLastIngestedDaysAgo(entityId: number, days: number): Promise<void> {
  await withClient(async (c) => {
    await c.query('UPDATE data_entity SET last_ingested_at = NOW() - make_interval(days => $2::int) WHERE id = $1', [
      entityId,
      days,
    ]);
  });
}

// IT-043 — F-008 UC-13 / F-005 lineage via ingestion: does a directed lineage edge exist (live)?
// Verified schema: lineage(parent_oddrn, child_oddrn, establisher_oddrn, is_deleted). A re-ingest that
// drops a transformer output should remove the omitted edge (replaceLineagePaths) -> returns false.
export async function lineageEdgeExists(parentOddrn: string, childOddrn: string): Promise<boolean> {
  return withClient(async (c) => {
    const r = await c.query(
      'SELECT 1 FROM lineage WHERE parent_oddrn = $1 AND child_oddrn = $2 AND (is_deleted IS NULL OR is_deleted = false) LIMIT 1',
      [parentOddrn, childOddrn],
    );
    return r.rows.length > 0;
  });
}
