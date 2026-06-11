import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * IT-065 — F-122 Operator Management-Endpoint Exposure Surface (Spring Boot Actuator). SECURITY-class.
 *
 * Protocol: integration-tests/protocols/IT-065-actuator-exposure.md
 * Gates: validates F-122 (UC-001 /actuator/** reachable unauthenticated · UC-009 which endpoints serve anon).
 *
 * `SecurityConstants.WHITELIST_PATHS` includes `/actuator/**` (SecurityConstants.java:26) — actuator is
 * reachable BEFORE auth in EVERY mode (DISABLED + LOGIN_FORM + OAUTH2 + LDAP). application.yml's management
 * block (application.yml:226-242) sets `enabled-by-default: false` and exposes ONLY `health, prometheus,
 * env, info`; there is NO `management.server.port` (actuator shares the main HTTP port) and NO `show-values`
 * key (so env value-masking is the Spring Boot framework default, NOT a platform contract — F-122 H-002).
 *
 * GROUNDED 2026-06-07 (curl :18080) — and the grounding surfaced a subtlety worth pinning:
 *   /actuator/health -> 200 {"status":"UP"}            (serves a real body anon)
 *   /actuator/info   -> 200 {"build":{...,"version":"0.27.13",...}}   (serves a real body anon — version leak)
 *   /actuator        -> 200 _links: self,info,health,health-path only
 *   /actuator/env, /actuator/prometheus  -> 500 SYS001 (NOT 401/403 — reached app code, NOT auth-gated)
 *   /actuator/beans|configprops|heapdump|threaddump|loggers|metrics -> 500 SYS001 too (disabled).
 *   /actuator/foobar123 (unknown id)     -> 500 SYS001 too.
 * i.e. the platform's catch-all ControllerAdvice (@ExceptionHandler(Exception.class) -> SERVER_EXCEPTION,
 * ControllerAdvice.java:62-66) SWALLOWS the actuator dispatcher: every /actuator/* except health+info returns
 * an indistinguishable 500 SYS001 over HTTP, whether the endpoint is enabled (env), disabled (beans), or
 * unknown (foobar123). So we CANNOT (and must not) assert a 200 credential dump from /actuator/env — it does
 * not currently happen. What IS verifiable and security-relevant: /actuator/** is NOT auth-gated (no 401/403).
 *
 * RESPONSIBLE DISCLOSURE: SECURITY characterization. The env/prometheus pins assert only THAT the path is
 * reachable unauthenticated (status is not an auth rejection) — a NON-sensitive marker. No body is read, no
 * value is asserted. Root cause + operator impact are ALREADY tracked in PLT-078 (restrict default exposure
 * list) + PLT-103 (env value leak); this spec adds the live regression guard, no new issue is minted. NB: the
 * env *value-dump* PLT-078/103 describe is not directly reproducible on :latest (env returns 500 via the
 * catch-all handler, matching the refactoring-scopes "actuator-leak refuted on Spring Boot 3.4.x" note); what
 * is real and pinned here is the reachability posture. No exploit recipe here.
 */

const ACTUATOR_MEDIA = 'application/vnd.spring-boot.actuator.v3+json';

/** Auth statuses: a request that the security layer rejected before reaching app code. */
const AUTH_REJECT = [401, 403];
/** A 302 to a login form is how LOGIN_FORM/OAUTH2 would gate a browser GET. */
const LOGIN_REDIRECT = 302;

/**
 * True iff the security layer did NOT gate the request — no 401/403 and no 302-to-login. Under the shipped
 * default auth.type=DISABLED nothing is gated; combined with the /actuator/** whitelist this is the posture
 * F-122 UC-001 characterizes. Reachability-only: the body is never read.
 */
async function reachableUnauthenticated(
  request: APIRequestContext,
  path: string,
  // prometheus serves text/plain, not the actuator JSON media type — a v3+json Accept gets 406 there.
  accept: string = ACTUATOR_MEDIA,
): Promise<number> {
  const res = await request.get(path, { headers: { accept }, maxRedirects: 0 });
  const status = res.status();
  expect(AUTH_REJECT, `${path} must not be auth-rejected (401/403) — it is whitelisted/open`).not.toContain(status);
  expect(status, `${path} must not redirect to a login form`).not.toBe(LOGIN_REDIRECT);
  return status;
}

test.describe('F-122 Operator Management-Endpoint Exposure Surface (actuator)', () => {
  test('it20650_UC-009: /actuator/health and /actuator/info serve a real body to an anonymous caller (info discloses the build version)', async ({
    request,
  }) => {
    // The two actuator endpoints that demonstrably serve content anonymously. health + info are exposed AND
    // return a 200 body with no credential (unlike env/prometheus which the global ControllerAdvice masks to 500).
    const health = await request.get('/actuator/health', { headers: { accept: ACTUATOR_MEDIA } });
    expect(health.status(), '/actuator/health is reachable (200) unauthenticated').toBe(200);
    expect(((await health.json()) as { status?: string }).status, '/actuator/health reports liveness').toBe('UP');

    const info = await request.get('/actuator/info', { headers: { accept: ACTUATOR_MEDIA } });
    expect(info.status(), '/actuator/info is reachable (200) unauthenticated').toBe(200);
    // info exposes build metadata incl. the version — part of the deployment fingerprint (NON-secret build coords).
    const infoBody = (await info.json()) as { build?: { version?: string } };
    expect(
      typeof infoBody.build?.version === 'string' && infoBody.build.version.length > 0,
      '/actuator/info discloses the build version to an anonymous caller (fingerprint surface)',
    ).toBe(true);
  });

  test('it20651_UC-001 [SECURITY pin]: /actuator/env serves ANONYMOUSLY (shipped default) with every property value masked', async ({
    request,
  }) => {
    // Characterization of the SHIPPED posture (LSN-029). /actuator/env sits under the /actuator/** whitelist
    // (SecurityConstants.java:26) AND application.yml exposes+enables it (:227-239); the shipped compose files
    // (docker/demo.yaml + examples) add no override — so a default deployment serves the full environment
    // document to an anonymous caller (maintainer-confirmed on demo.oddp.io @ 0.27.13: HTTP 200). The values
    // are masked '******' by Spring Boot's show-values=NEVER default (no override in the repo — PLT-078;
    // demo-verified 203/203 properties masked), so the anonymous yield is the config-KEY schema, not values.
    // RE-GROUND HISTORY: the 2026-06-11 morning re-ground asserted 404 "no route / dead config" — WRONG
    // (CTRIB-005 correction, maintainer-caught): the 404 came from the HARNESS's own
    // MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=health,info override in the probe-stack compose, removed the
    // same day so the e2e stack mirrors the shipped default. (The pre-fix "500" was that same harness-404
    // swallowed by the advice catch-all.)
    // RED when: 401/403/302 (auth-gated — surface narrowed, GOOD: re-scope) · 404 (exposure narrowed or the
    // harness override regressed) · any UNMASKED value (escalate: PLT-078's exposure becomes value-leaking).
    const status = await reachableUnauthenticated(request, '/actuator/env');
    expect(
      status,
      'SECURITY: the shipped default serves /actuator/env to an anonymous caller (whitelist + exposure)',
    ).toBe(200);
    const res = await request.get('/actuator/env');
    const body = (await res.json()) as {
      propertySources?: Array<{ properties?: Record<string, { value?: unknown }> }>;
    };
    const values = (body.propertySources ?? []).flatMap((ps) => Object.values(ps.properties ?? {}));
    expect(values.length, 'the env document carries the property catalog (key schema)').toBeGreaterThan(0);
    const unmasked = values.filter((v) => v.value !== '******');
    expect(
      unmasked.length,
      'every property VALUE is masked ****** (show-values=NEVER framework default — PLT-078); an unmasked value is a live credential-schema leak',
    ).toBe(0);
  });

  test('it20652_UC-005 [SECURITY pin]: /actuator/prometheus (operator metrics) serves ANONYMOUSLY (shipped default)', async ({
    request,
  }) => {
    // Second whitelisted surface: exposed+enabled in application.yml (:230,:235-236) with
    // micrometer-registry-prometheus on the classpath (build.gradle:29); maintainer-confirmed live on
    // demo.oddp.io @ 0.27.13 (HTTP 200, real metrics). Same re-ground history as env above: the prior
    // 404/500 observations were the harness exposure override, not the platform (CTRIB-005 correction).
    // PLT-198 (R2DBC pool gauge) is unblocked — the scrape surface is real.
    // RED when: 401/403/302 (auth narrowed) or 404 (exposure narrowed/harness override regressed).
    const status = await reachableUnauthenticated(request, '/actuator/prometheus', 'text/plain');
    expect(
      status,
      'SECURITY: the shipped default serves /actuator/prometheus to an anonymous caller — operator metrics are open',
    ).toBe(200);
    const res = await request.get('/actuator/prometheus');
    expect(
      await res.text(),
      'the scrape body carries real Prometheus metrics',
    ).toContain('jvm_memory');
  });
});
