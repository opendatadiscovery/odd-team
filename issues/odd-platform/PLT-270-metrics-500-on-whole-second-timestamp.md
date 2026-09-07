---
id: PLT-270
title: "GET /api/dataentities/{id}/metrics returns 500 when a Prometheus sample timestamp lands on a whole second"
target_repo: odd-platform
issue_type: bug
status: filed            # FILED 2026-09-07 as odd-platform#1887 by odd-contributor[bot] during CTRIB-067 Phase D,
                         # with NO milestone (G-C11). Read back publicly: 70 body lines, pure ASCII, both labels,
                         # zero workspace-internal ids.
severity: medium
discovered_during: "CTRIB-067 Phase D full unit build -- PrometheusMetricsIngestionTest failed with the server-side stack trace visible for the first time (odd-team TST-046 instance 3)"
github_issue_url: "https://github.com/opendatadiscovery/odd-platform/issues/1887"
github_issue_number: 1887
found_date: "2026-09-07"
user_facing_verified: true   # the failing path IS the user's metrics view; the stack trace names the controller
suggested_milestone: ""      # none -- release planning is the maintainer's (G-C11)
filed_title: "Metrics endpoint 500s when a Prometheus timestamp has no fractional part"
filed_labels: "kind: bug, scope: backend"
---

## Summary

`GET /api/dataentities/{data_entity_id}/metrics` fails with HTTP 500 whenever one of the returned Prometheus
samples carries a timestamp with no fractional part. The metrics view of the affected data entity shows an error
instead of its metrics; a reload usually succeeds, because the next sample's timestamp usually has a fraction.

## The error

```
java.lang.IllegalArgumentException: Unexpected value for timestamp 1788815968
    at PrometheusMetricsMapperImpl.getTimestampValue(PrometheusMetricsMapperImpl.java:219)
    at PrometheusMetricsMapperImpl.enrichMetric(PrometheusMetricsMapperImpl.java:97)
    at PrometheusMetricsMapperImpl.mapMetrics(PrometheusMetricsMapperImpl.java:79)
    at PrometheusMetricsMapperImpl.mapFromPrometheus(PrometheusMetricsMapperImpl.java:61)
    at ExternalMetricReader.lambda$getLatestMetricsForOddrn$2(ExternalMetricReader.java:77)
    ... Handler DataEntityController#getDataEntityMetrics(Long, ServerWebExchange)
```

## Cause

Prometheus's instant-query result carries each sample as `"value": [<unix_time>, "<sample_value>"]`, where
`<unix_time>` is a JSON **number**: seconds, with a fractional part only when the timestamp has one.

`PrometheusMetric.value` is declared `List<Object>`, so Jackson picks the type from the JSON literal:

| Prometheus emits | Jackson binds to |
|---|---|
| `1788815968.123` | `Double` |
| `1788815968` | **`Integer`** |

`PrometheusMetricsMapperImpl.getTimestampValue` handles only `String` and `Double`, and throws
`IllegalArgumentException` for anything else -- so the whole-second case fails. `ControllerAdvice` maps that to
HTTP 500.

The exception message is its own proof of the type: it is built with `"...%s".formatted(object)`, so a `Double`
would have printed `1.788815968E9`, and a `String` would have matched the earlier branch. A bare `1788815968` can
only be an `Integer` (or a `Long` for timestamps past 2038).

## Why it looks random

Sample timestamps rarely land exactly on a second, so the failure is intermittent for an operator and looks like a
transient. It is not: the same input always fails, the input is just uncommon. The project's own
`PrometheusMetricsIngestionTest` -- which drives a real `prom/prometheus:v2.42.0` container and reads back whatever
timestamp the sample received -- has now hit it at least three times, in GitHub Actions and in two local builds,
each time reported as a flake because the assertion only shows `expected 200 but was 500` and hides the cause.

## Suggested fix

Accept every JSON number shape in `getTimestampValue`, not two of them:

```java
final double timestamp;
if (object instanceof Number n) {          // Integer, Long, Double - whatever Jackson chose
    timestamp = n.doubleValue();
} else if (object instanceof String s) {
    timestamp = Double.parseDouble(s);
} else {
    throw new IllegalArgumentException(...);
}
```

The sibling `getValue` a few lines above has the same shape of assumption and is worth checking in the same pass.
A `Long`-typed timestamp is not hypothetical either: epoch seconds exceed `Integer.MAX_VALUE` in 2038, so an
`Integer`-only fix would move the bug rather than remove it.

## Test

The existing `PrometheusMetricsIngestionTest` cannot pin this -- it depends on a timestamp it does not control. A
unit test on the mapper can: feed `List.of(1788815968, "42")` and assert the mapped timestamp, alongside the
existing `Double` and `String` shapes. That test fails today and passes on the fix, and it takes milliseconds.
