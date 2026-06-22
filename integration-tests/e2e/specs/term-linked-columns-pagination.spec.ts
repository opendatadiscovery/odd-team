import { test, expect } from '@playwright/test';
import { dbQuery, seedTermWithDefinition } from '../helpers/db';

/**
 * IT-139 — F-153 / #1754 Defect 4: the Term "Linked columns" tab paginates past the page size, and the
 * backend page_info reports the REAL total + hasNext (so the tab badge no longer disagrees with the list).
 *
 * Protocol: integration-tests/protocols/IT-139-term-linked-columns-pagination.md
 * Gates: validates F-153, regresses PLT-058 (CTRIB-028).
 *
 * Pre-fix (ref:main): LinkedColumnsList pins page 1 + a noop InfiniteScroll, and the backend mapper
 * hardcodes page_info(hasNext=false, total=<returned page size>) — so a term with 60 linked columns shows
 * a tab badge "60" over a list that silently stops at 50. This IT seeds 60 and asserts all 60 are reachable.
 */
const NS = 'it139_ns';
const TERM = 'it139_PiiTerm';
const TOTAL = 60;
const SIZE = 50; // the FE page size — TOTAL must exceed it to exercise the cap
const ODDRN = '//it139/db/tables/pii_table';

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await dbQuery<T>(sql, params);
  return r[0];
}

// Seed a term with TOTAL real linked columns (each a column of one dataset, so the linked-columns
// mapper's data_entity resolves). Idempotent on the //it139/ oddrn prefix.
async function seedTermWith60LinkedColumns(): Promise<number> {
  const termId = await seedTermWithDefinition(TERM, 'IT139 term with >50 linked columns', NS);

  await dbQuery(`INSERT INTO data_source (id, oddrn, name) VALUES (31390,'//it139/src','it139-src') ON CONFLICT (id) DO NOTHING`);
  await dbQuery(
    `INSERT INTO data_entity (id, oddrn, external_name, data_source_id, type_id, entity_class_ids, view_count, source_created_at, source_updated_at)
     VALUES (31390,$1,'it139_pii_table',31390,1,'{1}',0,NOW(),NOW())
     ON CONFLICT (id) DO UPDATE SET entity_class_ids='{1}'`,
    [ODDRN],
  );
  // idempotent reset of prior IT-139 rows
  await dbQuery(`DELETE FROM dataset_field_to_term WHERE term_id=$1`, [termId]);
  await dbQuery(`DELETE FROM dataset_structure ds USING dataset_version dv WHERE ds.dataset_version_id=dv.id AND dv.dataset_oddrn=$1`, [ODDRN]);
  await dbQuery(`DELETE FROM dataset_version WHERE dataset_oddrn=$1`, [ODDRN]);
  await dbQuery(`DELETE FROM dataset_field WHERE oddrn LIKE '//it139/%'`);

  const vid = Number(
    (await one<{ id: number }>(
      `INSERT INTO dataset_version (version, version_hash, created_at, dataset_oddrn) VALUES (1,'it139-v1',NOW(),$1) RETURNING id`,
      [ODDRN],
    )).id,
  );
  for (let i = 1; i <= TOTAL; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const fid = Number(
      (await one<{ id: number }>(
        `INSERT INTO dataset_field (name, oddrn, field_order, type, stats, is_primary_key, is_sort_key, is_key, is_value)
         VALUES ($1,$2,$3,'{"type":"TYPE_STRING","logical_type":"varchar","is_nullable":true}'::jsonb,'{}'::jsonb,false,false,false,false) RETURNING id`,
        [`it139_col_${String(i).padStart(3, '0')}`, `//it139/columns/${i}`, i],
      )).id,
    );
    // eslint-disable-next-line no-await-in-loop
    await dbQuery(`INSERT INTO dataset_structure (dataset_version_id, dataset_field_id) VALUES ($1,$2)`, [vid, fid]);
    // eslint-disable-next-line no-await-in-loop
    await dbQuery(`INSERT INTO dataset_field_to_term (dataset_field_id, term_id, is_description_link) VALUES ($1,$2,false)`, [fid, termId]);
  }
  return termId;
}

test.describe('F-153 / #1754 D4 — Term linked-columns paginate past the size cap', () => {
  test(`a term with ${TOTAL} linked columns shows all ${TOTAL} (badge matches the list)`, async ({ page }) => {
    const termId = await seedTermWith60LinkedColumns();

    await page.goto(`/terms/${termId}/linked-columns`);
    await page.waitForResponse(r => r.url().includes('/linked_columns') && r.ok());

    // the tab badge shows the real total
    await expect(
      page.getByRole('tab', { name: 'Linked columns' }).getByText(String(TOTAL)),
      'the Linked columns tab badge shows the real total',
    ).toBeVisible({ timeout: 10_000 });

    // scroll the list container to pull subsequent pages (InfiniteScroll on #term-linked-columns-list)
    for (let i = 0; i < 8; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await page.locator('#term-linked-columns-list').evaluate(el => el.scrollTo(0, el.scrollHeight));
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(400);
    }

    const rows = await page.getByText(/^it139_col_\d+$/).count();
    expect(rows, `all ${TOTAL} linked columns are reachable (no silent ${SIZE}-cap)`).toBe(TOTAL);
  });
});
