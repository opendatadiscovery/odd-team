# SHB-174 — MinIO SDK builder ships THREE caveat-defaulted parameters, not one — LSN-002 generalises

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators running ODD's REMOTE attachment storage (`attachment.storage=REMOTE`) inherit silent SDK defaults on THREE distinct MinIO `MinioAsyncClient.builder()` parameters — `.region(...)`, `.httpClient(...)`, and `.credentialsProvider(...)` — not just the one parameter LSN-002 named. The known LSN-002 caveat (`us-east-1` region pin against AWS S3) is the most visible; the second (~5-minute HTTP timeouts unconfigurable) breaks large-file uploads on slow networks; the third (no IAM-instance-profile / IRSA support) forces AWS EKS operators to manage static keys when their cloud platform would otherwise rotate credentials for them. Only the `.region(...)` caveat has doc-side mitigation today.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/MinioConfig.java:19-25` — the builder chain is exactly `.endpoint(url).credentials(accessKey, secretKey).build()`. Three SDK builder methods are NEVER called.
- `lineage/odd-platform/understanding/odd-platform__java__MinioConfig__config-class__MinioConfig.md` — Gate-5 unset-parameter audit table classifies `.region(...)`, `.httpClient(...)`, `.credentialsProvider(...)` all as `caveat-defaulted` (per playbooks/unset-parameter-audit.md).
- `retrospectives/LSN-002-minio-region-unset.md` — the canonical retrospective for `.region(...)` only; the other two unset parameters are not in the retrospective lineage.
- `bash grep -r 'attachment.remote.region' <odd-platform-repo>` returns zero matches — no operator-tunable knob exists for region. Same for `attachment.remote.connect-timeout-millis`, `attachment.remote.read-timeout-millis`, `attachment.remote.credentials-provider`.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` (verified 2026-05-20 status 200) — the operator page documents the `.region(...)` caveat verbatim ("AWS S3 region pinned to `us-east-1`"); also names the `.httpClient(...)` ~5-minute-timeout caveat in passing ("HTTP client timeouts are the MinIO SDK defaults (~5 minutes), not configurable"). The `.credentialsProvider(...)` IAM-role gap is NOT mentioned anywhere on the live operator page.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/attachment/RemoteFileUploadServiceImpl.java:45-50` — the ONLY `@PostConstruct` in the REMOTE pipeline checks `StringUtils.isEmpty(bucket)`; no boot-time validation of region, URL reachability, credential validity, or bucket existence.

## Notes

- **The class of bug is wider than the retrospective.** LSN-002 framed the gap as "the MinIO SDK builder omits `.region(...)`"; the actual class is "the platform's REMOTE attachment surface inherits every MinIO SDK default that isn't deliberately overridden". Audit shape applies to ANY SDK-builder ODD wires: Snowflake, Kafka, BigQuery, etc. The pattern is missing-by-default vs documented-default.
- **Three caveat-defaults compound at deployment time.** An AWS EKS operator deploying REMOTE storage hits all three: (1) bucket must be in `us-east-1` (or the request signature fails), (2) large CSV uploads hang at 5-minute socket timeout, (3) they must mint a static IAM user with `AmazonS3FullAccess` because IRSA isn't supported.
- **`.credentialsProvider(...)` is the operator-experience defect.** AWS best-practice and modern Kubernetes deployments use IAM-instance-profile / IRSA / Pod-identity to avoid static keys; ODD's MinIO SDK wiring is `StaticProvider`-only via the two-arg `.credentials(accessKey, secretKey)` call. Combined with the `/actuator/env` exposure surface (see SHB-177) this means operators MUST manage static keys AND those keys are reachable via the management endpoint. Cross-cutting failure.
- **Doc-side fix is the cheapest mitigation; code-side fix is the right one.** Adding `attachment.remote.region`, `attachment.remote.connect-timeout-millis`, `attachment.remote.read-timeout-millis`, and `attachment.remote.credentials-provider` as operator knobs would close all three. Until then, the operator page needs (at minimum) the `.credentialsProvider(...)` gap documented.
- This thread is `clustering` — evidence is across the MinioConfig file, the unset-parameter audit, the retrospective, the WebFetched docs, and the application.yml shape. The graduation gate is met; deferral is capacity not evidence.
- Related: SHB-001 (DataEntityStaleDetector silent-default class); SHB-177 (actuator credentials exposure); REFACTOR-027 (region), REFACTOR-028 (bucket existence), REFACTOR-034 (HTTP timeouts), REFACTOR-029 (actuator leak).

## Next

1. **Graduate** — `F-NNN — REMOTE Attachment Storage SDK Builder Unset-Parameter Class`. Primary subjects: MinioConfig + RemoteFileUploadServiceImpl + the four refactoring scopes + LSN-002. Pillar P-08 (operator config).
2. **Open follow-ups**:
   - SEC-NNN — Add `.credentialsProvider(...)` IAM-role-based credentials support (allow `DefaultCredentialsProvider` / `IamAwsProvider` / IRSA paths).
   - DOC-NNN — operator page should document the `.credentialsProvider(...)` gap as a known limitation parallel to the existing `.region(...)` and `.httpClient(...)` admonitions.
   - REFACTOR-NNN — add `@PostConstruct` validation pattern in MinioConfig itself, not only in the downstream RemoteFileUploadServiceImpl (asymmetric validation noted in the sidecar's coherence_check).
3. **Probe** — boot the platform with `attachment.storage=REMOTE` against a fresh MinIO container + a known-good bucket, then audit the `OkHttpClient`'s connection timeout via the SDK's internal-instrumentation. Confirm the 5-minute default empirically.
4. **DOC-NNN** — operator page should also document the boot-vs-runtime validation gap: REMOTE bean wires successfully even when the bucket doesn't exist / endpoint unreachable / credentials wrong — first upload reveals the issue.

## Links

- cluster_with: [F-027]
- merged_into: (open)
- supersedes: []
