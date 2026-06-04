// Ingestion-API seed helper — POSTs through the REAL ODD ingestion contract.
//
// Why this exists (PHASE3-BUILDOUT plateau, maintainer unlock option b): the raw-DB
// helpers in db.ts can render display surfaces, but the CRITICAL ingestion/data features
// (F-008 batch ingestion, F-030 metrics, F-022 DQ, dataset structure with realistic data)
// are only reachable by driving the real ingestion endpoints. The ingestion write path IS
// the feature under test for F-008, so here the "seed" and the "act" are the same call.
//
// Wire is snake_case (data_source_oddrn, field_list — see KEY LESSON 2). Base URL = the
// running stack's platform (ODD_BASE_URL or the odd-minimal default :18080). Under
// odd-minimal (AUTH_TYPE=DISABLED → permitAll) these POSTs work without a collector token;
// the conditional IngestionDataEntitiesFilter is OFF by default (this is F-008-UC-01).

const BASE = process.env.ODD_BASE_URL ?? 'http://localhost:18080';

export interface IngestEntity {
  oddrn: string;
  name: string;
  type: string; // DataEntityType enum, e.g. 'TABLE'
  description?: string | null;
  metadata?: unknown[];
  dataset?: { parent_oddrn?: string | null; rows_number?: number | null; field_list?: unknown[] } | null;
  [k: string]: unknown;
}

// Register a datasource via the platform API (POST /api/datasources). Returns the oddrn the
// ingestion items must reference. Idempotent-friendly: a duplicate oddrn returns the existing
// one (or a 4xx we surface). Anonymous under odd-minimal (DISABLED → permitAll).
export async function createDataSource(
  oddrn: string,
  name: string,
  namespaceName = 'it-ingest-ns',
): Promise<string> {
  const res = await fetch(`${BASE}/api/datasources`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, oddrn, namespace_name: namespaceName }),
  });
  if (!res.ok) {
    throw new Error(`createDataSource POST /api/datasources -> ${res.status}: ${await res.text()}`);
  }
  const ds = (await res.json()) as { oddrn?: string };
  return ds.oddrn ?? oddrn;
}

// Ingest a batch of entities (POST /ingestion/entities). Returns the raw HTTP status so a
// caller can assert success (200) OR pin a failure mode (e.g. duplicate-oddrn 5xx — F-008-UC-06).
export async function ingestEntities(dataSourceOddrn: string, items: IngestEntity[]): Promise<number> {
  const res = await fetch(`${BASE}/ingestion/entities`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data_source_oddrn: dataSourceOddrn, items }),
  });
  // drain the body so the socket is freed (status is the signal we assert on)
  await res.text().catch(() => undefined);
  return res.status;
}

// The simplest valid ingestion item: a TABLE dataset entity (DATA_SET class). Mirrors the
// minimal shape in odd-platform's ingestion/samples/*.json (07_kinesis: oddrn/name/type +
// dataset.field_list). `extra` overrides any field (e.g. description, a populated field_list).
export function tableEntity(oddrn: string, name: string, extra: Partial<IngestEntity> = {}): IngestEntity {
  return { oddrn, name, type: 'TABLE', metadata: [], dataset: { field_list: [] }, ...extra };
}

// A JOB (DATA_TRANSFORMER) entity carrying lineage. Verified shape (ingestion/samples/01_airflow):
// data_transformer = { source_code_url, sql, inputs[], outputs[] } where inputs/outputs are ODDRN arrays.
// Ingesting it creates lineage edges: each input -> job -> each output.
export function transformerEntity(oddrn: string, name: string, inputs: string[], outputs: string[]): IngestEntity {
  return {
    oddrn,
    name,
    type: 'JOB',
    metadata: [],
    data_transformer: { source_code_url: null, sql: null, inputs, outputs },
  };
}

// ---- F-095 statistics ingestion (POST /ingestion/entities/datasets/stats) ----
// DatasetStatisticsList = { items: [ { dataset_oddrn, fields: { <field_oddrn>: DataSetFieldStat } } ] }.
// DataSetFieldStat wraps a TYPE-specific block: number_stats / integer_stats / string_stats / etc.
// ⚠ verified via probe: a WRONG wrapper key is silently ignored (hollow 201) — always assert the read-back.
export interface NumberStats {
  low_value?: number;
  high_value?: number;
  mean_value?: number;
  median_value?: number;
  nulls_count: number;
  unique_count: number;
}

export async function ingestNumberFieldStats(
  datasetOddrn: string,
  fieldOddrn: string,
  fieldName: string,
  numberStats: NumberStats,
): Promise<number> {
  const res = await fetch(`${BASE}/ingestion/entities/datasets/stats`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [{ dataset_oddrn: datasetOddrn, fields: { [fieldOddrn]: { name: fieldName, number_stats: numberStats } } }],
    }),
  });
  await res.text().catch(() => undefined);
  return res.status;
}

// A TYPE_NUMBER dataset column (so number_stats apply to it).
export function numberField(oddrn: string, name: string): Record<string, unknown> {
  return { oddrn, name, type: { type: 'TYPE_NUMBER', logical_type: 'bigint', is_nullable: true } };
}

// ---- F-030 metrics ingestion (POST /ingestion/metrics) ----
// MetricSetList = { items: [ { oddrn, metric_families } ] } (per MetricsIngestionTest.createMetrics).
export interface MetricFamily {
  name: string;
  type: string; // GAUGE | COUNTER | HISTOGRAM | SUMMARY
  unit?: string;
  metrics: unknown[];
}

// Ingest metric families against an already-ingested entity (by oddrn). Returns the HTTP status
// (201 on success — metrics are a distinct ingestion endpoint from /ingestion/entities).
export async function ingestMetrics(entityOddrn: string, metricFamilies: MetricFamily[]): Promise<number> {
  const res = await fetch(`${BASE}/ingestion/metrics`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: [{ oddrn: entityOddrn, metric_families: metricFamilies }] }),
  });
  await res.text().catch(() => undefined);
  return res.status;
}

// A minimal single-point GAUGE family (the simplest valid metric — mirrors metrics/gauge_and_count.json).
export function gaugeFamily(name: string, value: number, unit = 'count'): MetricFamily {
  return {
    name,
    type: 'GAUGE',
    unit,
    metrics: [{ labels: [], metric_points: [{ timestamp: 1700000000, gauge_value: { value } }] }],
  };
}

// Read an entity's metrics back (GET /api/dataentities/{id}/metrics → MetricSet, snake_case wire).
// Returns the raw body so a spec can assert a family name / value is present (or absent on the
// negative path). id comes from a DB oddrn lookup (entityByOddrn in helpers/db.ts).
export async function getEntityMetricsBody(id: number): Promise<{ status: number; body: string }> {
  const res = await fetch(`${BASE}/api/dataentities/${id}/metrics`);
  return { status: res.status, body: await res.text() };
}
