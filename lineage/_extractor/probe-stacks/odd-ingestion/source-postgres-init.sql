-- IT-128 ERD half — the KNOWN truth the e2e asserts ODD against.
-- Three tables, TWO named FK constraints, chosen to exercise BOTH derivation paths of
-- the collector's postgresql adapter (odd-collectors .../postgresql/mappers/relationships/):
--
--   orders_customer_fk            orders(customer_id) -> customers(id)
--     source = orders (the FK-HOLDING / child table), target = customers (referenced /
--     parent) — mapper.py maps source=constraint's table, target=referenced table;
--     customer_id is NOT part of orders' PK and has no unique constraint
--       -> cardinality ONE_TO_ZERO_ONE_OR_MORE (cardinality_checker.py: not _is_ref_to_unique)
--       -> is_identifying = false       (identifying_checker.py: fk not part of child PK)
--
--   customer_profiles_customer_fk customer_profiles(customer_id) -> customers(id)
--     customer_id IS the child's whole PK and references the parent's whole PK
--       -> cardinality ONE_TO_ZERO_OR_ONE (fk column is_primary_key -> _is_ref_to_unique)
--       -> is_identifying = true
--
-- The relationship entity's NAME in ODD is the constraint name — name them explicitly.
CREATE TABLE customers (
    id   BIGINT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE orders (
    id          BIGINT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    placed_at   TIMESTAMP,
    CONSTRAINT orders_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (id)
);

CREATE TABLE customer_profiles (
    customer_id  BIGINT PRIMARY KEY,
    loyalty_tier TEXT,
    CONSTRAINT customer_profiles_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (id)
);

-- A few rows for realism (metadata ingestion does not require them).
INSERT INTO customers VALUES (1, 'Acme Analytics'), (2, 'Globex');
INSERT INTO orders VALUES (10, 1, NOW()), (11, 1, NOW()), (12, 2, NOW());
INSERT INTO customer_profiles VALUES (1, 'gold'), (2, 'silver');
