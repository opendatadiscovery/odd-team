-- IT-145 — the KNOWN source truth the ingestion-grade DATASET-pipeline e2e asserts ODD against.
--
-- Unlike IT-128 (relationships), this stand exercises the CORE collect→store→visualize
-- surface: tables/views as datasets, columns + ODD type mapping, table/column COMMENTs as
-- descriptions/metadata, row counts, and VIEW→table lineage. Every column type below is
-- chosen so the collector's mapping is UNAMBIGUOUS — TYPES_SQL_TO_ODD is keyed on
-- pg_type.typname (odd-collectors .../postgresql/mappers/types.py), NOT the SQL spelling:
--
--   bigint   → typname int8      → Type.TYPE_INTEGER   (both 'bigint' and 'int8' mapped)
--   integer  → typname int4      → Type.TYPE_INTEGER
--   text     → typname text      → Type.TYPE_STRING
--   varchar  → typname varchar   → Type.TYPE_STRING
--   numeric  → typname numeric   → Type.TYPE_NUMBER
--   date     → typname date      → Type.TYPE_DATETIME
--   timestamp(without tz) → typname timestamp → Type.TYPE_DATETIME
--
-- (boolean→'bool', timestamptz→'timestamptz', float8→'float8' are DELIBERATELY avoided —
-- their typnames are NOT in TYPES_SQL_TO_ODD, so they map to TYPE_UNKNOWN; that adapter
-- gap is a separate finding, not what this pipeline test pins.)
--
-- COMMENT ON TABLE/COLUMN → repository.py obj_description / col_description →
--   mappers/tables.py DataEntity.description + DataSetField.description.
-- reltuples (after ANALYZE) → DataSet.rows_number (silent(int) in tables.py).
-- A VIEW → mappers/views.py DataTransformer; create_lineage (adapter.py) threads its
--   table dependencies into data_transformer.inputs → an upstream lineage edge in ODD.

CREATE TABLE products (
    id          bigint PRIMARY KEY,
    sku         text         NOT NULL,
    title       varchar(200),
    price       numeric(10, 2),
    released_on date,
    created_at  timestamp,
    in_stock    integer      DEFAULT 0
);
COMMENT ON TABLE products IS 'Catalog of sellable products';
COMMENT ON COLUMN products.sku IS 'Stock keeping unit, unique per product';

CREATE TABLE categories (
    id   bigint PRIMARY KEY,
    name text NOT NULL
);
COMMENT ON TABLE categories IS 'Product categories taxonomy';

-- A VIEW over products → the lineage half: ODD ingests it as a transformer whose INPUT is
-- the products dataset (create_lineage resolves the view's table dependency).
CREATE VIEW active_products AS
    SELECT id, sku, title, price
    FROM products
    WHERE in_stock > 0;
COMMENT ON VIEW active_products IS 'Products currently in stock';

INSERT INTO products (id, sku, title, price, released_on, created_at, in_stock) VALUES
    (1, 'SKU-0001', 'Widget',  9.99,  DATE '2026-01-10', TIMESTAMP '2026-01-10 09:00:00', 5),
    (2, 'SKU-0002', 'Gadget',  19.99, DATE '2026-02-15', TIMESTAMP '2026-02-15 10:30:00', 0),
    (3, 'SKU-0003', 'Gizmo',   4.50,  DATE '2026-03-20', TIMESTAMP '2026-03-20 14:45:00', 12);

INSERT INTO categories (id, name) VALUES
    (1, 'Tools'),
    (2, 'Toys');

-- reltuples is a planner estimate, -1 / 0 until analysed — ANALYZE so rows_number is exact.
ANALYZE;
