// IT-128 GRAPH half — the KNOWN truth the e2e asserts ODD against.
// Idempotent: wipes and recreates. 4 labelled nodes, 5 typed DIRECTED relationships.
// The collector's neo4j adapter maps DISTINCT (labels(s), type(r), labels(t)) triples:
//   source = the cypher edge's START node label, target = its END node label
//   (odd-collectors .../adapters/neo4j/adapter.py `MATCH (s)-[r]->(t)` +
//    mappers/relationships.py source=relationship[0] / target=relationship[2]),
// so each line below IS the direction contract the assertions encode.
// Reused from the maintainer's throwaway stand (odd-platform docker/relationships-test/,
// 2026-06-12) — same shape, same names.
MATCH (n) DETACH DELETE n;
CREATE
  (alice:Person {name: 'Alice Femling', age: 34, email: 'alice@acme.io'}),
  (acme:Company {name: 'Acme Analytics', industry: 'Data Tooling', founded: 2012}),
  (berlin:City {name: 'Berlin', country: 'Germany', population: 3700000}),
  (apollo:Project {name: 'Apollo', budget: 250000, active: true}),
  (alice)-[:WORKS_AT {since: 2019, position: 'Lead Engineer'}]->(acme),
  (alice)-[:LIVES_IN {since: 2015}]->(berlin),
  (acme)-[:HEADQUARTERED_IN {address: 'Alexanderplatz 1'}]->(berlin),
  (alice)-[:CONTRIBUTES_TO {role: 'maintainer', hours_per_week: 12}]->(apollo),
  (acme)-[:SPONSORS {amount: 50000}]->(apollo);
